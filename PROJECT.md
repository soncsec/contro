# Contro — Product Requirements

> **Status:** APPROVED by owner 2026-10-17
> **Owner:** soncsec (approves scope, merges, and production releases)
> **Dev lead:** Claude Code

## 1. Summary

Contro is a single-player, browser-based sci-fi **run-and-gun platformer** in the style of Contra. A space marine runs, jumps and shoots through three levels (an industrial zone, a cyberpunk corridor and an alien hive), fighting walking and flying aliens, tanks and mechs, and ends each level against a boss. Short portrait dialogue cards play between levels.

It is built from the Ansimuz "Legacy Collection" pixel-art pack (mainly the Warped sci-fi set, CC0) and is the second game on the **games.soncrant.com** portal, after Star Destroyer.

## 2. Goals

- A complete, polished game a stranger can open from a URL and finish with no setup.
- Classic run-and-gun feel: responsive running and jumping, readable enemies, fair but challenging fights.
- The same quality bar and delivery process as Star Destroyer: tested, reviewable, and released through the shared portal pipeline.

## 3. Users

- **Primary:** casual players on desktop browsers (Chrome, Firefox), reaching the site over the public internet, using a keyboard or a gamepad.
- **Secondary:** the owner, as play-tester and reviewer.

## 4. Scope — Version 1.0

### In scope

| Area | Requirement |
|---|---|
| Levels | **3 levels, each ending in a boss** (owner decision 2026-10-17): 1 Industrial, 2 Cyberpunk Corridor, 3 Alien Hive. **Each level is a lot longer and more varied** (owner request 2026-10-18): about **5–8 minutes including the boss** (owner decision 2026-10-18, after playing Level 1's five sections in about 4 minutes: "felt close to long enough"; was 10–15 minutes), built from **at least 5 sections** (separate maps played back to back, with a checkpoint at each), each with its own scenery and set piece: e.g. multi-level ground, catwalk climbs, pit runs, an outdoor or rooftop stretch, a gauntlet of mixed enemies, a mini-boss. Dialogue cards only between levels |
| Multi-level ground | Some side-scrolling stretches have **ground at several heights**, like Contra: raised ledges, upper and lower paths, and drops between them, each with enemies (owner request 2026-10-17) |
| Level display | The screen shows the **current level and section** (e.g. `1-3`) in the HUD, and a banner with the level's number and name when a level starts (owner request 2026-10-18) |
| Test rooms | The two corridor test rooms are **not part of the game** (owner left it to Claude, 2026-10-18): they stay in the repo as a training level that only the e2e build plays first, so browser tests keep small fixed rooms |
| Health between sections | **Health carries over** from section to section and level to level, like score and lives (owner request 2026-10-18). A respawn after losing a life still starts with full health |
| Player | The Warped space marine: idle, run, jump, crouch, shoot, die |
| Aiming | Forward (standing, running, jumping), crouched forward, **diagonal up**, and **diagonal down while running or jumping** (owner request 2026-10-18, roadmap M3.13: down alone crouches; down plus left or right runs that way aiming 45° down; in the air down plus a direction aims down, and down alone still drops through catwalks). The diagonal frames are derived from the existing art by Claude. Aim poses are data in the asset manifest so better art can replace them later without code changes (owner decision 2026-10-17) |
| Controls | Keyboard, **gamepad** (standard mapping) and **phone touch controls** (on-screen buttons on touch screens; owner approved 2026-10-18). Default keys: arrows or WASD to move, jump, fire, aim-up modifier, pause. Final key layout settled in M1/M2 play-tests |
| Health | **Health bar** with several hits per life, brief invulnerability after a hit, **mid-level checkpoints**, and a small number of lives with continue from the last checkpoint (owner decision 2026-10-17). Exact numbers live in `src/config/tuning.ts` |
| Enemies | Walking alien, flying alien, bipedal walker, alien creatures; enemy shots. **Enemies also run in from the edges of the screen**, as in Contra, including a fast one-hit **runner** variant of the walking alien (owner left it to Claude, 2026-10-18; roadmap M3.14) |
| Bosses | Level 1: **tank**. Level 2: **mech**. Level 3: an alien boss using **Gothicvania boss art, recolored** to fit (owner approved 2026-10-17): the **demon, in hive colours** (acid green wings and flames; owner chose it from mockups, 2026-10-20). Each with a health bar, phases and attack patterns |
| Weapons | Default rifle fires **one shot per press** (no auto-fire when held; owner request 2026-10-17, issue #21). **On touch screens, holding the on-screen FIRE button auto-fires** (owner approved 2026-10-18), since tapping glass fast is tiring; keys and gamepad keep one shot per press. Plus **two weapon pickups: a machine gun** that auto-fires while fire is held, and a **spread gun** firing three bullets in a fan, **dropped by a blimp** the marine shoots down (one shot), as in Contra's pods; a pickup lasts until he loses a life (owner decisions 2026-10-19). Blimps can also carry a **full-health restore** (a red cross); **every section has two blimps**, one weapon and one health (owner requests 2026-10-19) |
| Hazards | Pits and one-way platforms. No slopes in v1. In corridor levels, platforms are **catwalks drawn by Claude** in the corridor's colours (owner chose option C of three mockups, 2026-10-17). Down + jump drops through a catwalk; falling into a pit costs a life. **Bullets and enemy shots pass through all terrain** (walls, floors and catwalks), as in Contra: a marine behind a wall can shoot up at an enemy, and cover protects nobody (owner request 2026-10-18, roadmap M3.12) |
| Double jump | **One extra jump in mid-air** (owner request 2026-10-17, roadmap M2.8). Restored on landing; also usable after walking off a ledge. Not in classic Contra; added for the platforming |
| Story | **Minimal text**: one or two lines with a speaker portrait on the card between levels, plus intro and ending cards (owner decision 2026-10-17). Text lives in a data file |
| Audio | **CC0 sound effects plus one music loop per level** (owner decision 2026-10-17), and a boss music loop. Each source needs owner approval and is listed in `CREDITS.md`. Level 1 sources approved 2026-10-19 (Kenney effects, ansimuz music). OGG plus M4A copies so iPhones play it too. Sound can be turned off from the pause menu |
| Saving | Furthest level reached, best score, and volume settings in localStorage, safe if storage is unavailable. **The title can start from any level already reached** (owner approved 2026-10-18, M3.5) |
| Scoring | **Points for each enemy destroyed** (walker 100, flyer 200, bosses more), shown in the HUD; best score saved. **Extra life at 20,000 and 50,000 points**, as in Contra. The score carries from room to room and resets on game over (owner request 2026-10-17, roadmap M2.9) |
| Fullscreen | **F toggles fullscreen** (owner request 2026-10-17, roadmap M2.10) |
| Cheat codes | Entered on the pause screen (owner request 2026-10-17, roadmap M2.11): **Konami code** (up up down down left right left right fire jump, keyboard or gamepad) for +5 lives; typed **IRON** invincibility (pits still kill), **GHOUL** invisibility (enemies don't aim or dive at you), **THRU** room skip; typed **GUNNY** steps through **all weapons** (rifle, machine gun, spread; word chosen by the owner 2026-10-19). A cheat shows CHEAT on the HUD and stops the best score from being saved |
| Screens | Title (with a link back to the portal and a **controls guide**, built early so first-time players know the keys; owner approved 2026-10-18), level intro card, game, pause, game over, continue, ending, credits |
| Font | **Press Start 2P** (SIL OFL 1.1), the same file Star Destroyer and the portal use, for the HUD, banners, cards and title (owner approved 2026-10-18). Bundled, never loaded from Google |
| Display | 320×176 game area at native pixel size, scaled by whole numbers with sharp pixels (confirmed in M1.2) |

### Out of scope (v1)

- Two-player co-op
- Straight-up and straight-down aiming (possible later with new art)
- Slopes
- Online leaderboards, accounts, payments, analytics
- Any backend or server-side code

## 5. Platform and integration

- Served as a static build at `games.soncrant.com/contro/` from the existing Apache server, over HTTP on port 80 (games-portal ADR-010).
- Listed in the portal by a PR to `soncsec/games-portal` (status `coming-soon` first, `live` at v1.0). Contro's session never edits the portal directly.
- Must work under the portal's strict Content Security Policy: no inline scripts or styles, no third-party requests.
- No personal data. localStorage holds only progress, best score and settings.

## 6. Art plan

| Use | Source (`legacy/`) |
|---|---|
| Player | `Warped/Characters/space-marine-lite` (75×48 frames) plus Claude-derived aim frames |
| Enemies | `Warped/Characters/alien-walking-enemy`, `alien-flying-enemy`, `bipedal-Unit`; Level 3 adds the `Grotto-escape-2-snake` as a spitting snake (owner chose it from a lineup of five creatures, 2026-10-20) |
| Bosses | `Warped/Characters/tank-unit`, `mech-unit`, `Gothicvania/Characters/demon-Files` (recoloured) |
| Level 1 Industrial | **The Steelworks** (owner chose option B of three mockups, 2026-10-18): teal steel floor, raised ledges and scaffold walkways from `Warped/Environments/bulkhead-walls/v1`, under the `parallax-industrial-web` skyline outdoors; one or two rust factory rooms from `bulkhead-walls/v2` (option C) for variety |
| Level 2 Cyberpunk Corridor | `Warped/Environments/cyberpunk-corridor-files`, props from `cyberpunk-detective-props` |
| Level 3 Alien Hive | **Into the hive** (owner chose it from mockups, 2026-10-20): the first two sections in the alien base (`Warped/Environments/alien-environment`: mossy bridges on trusses), the last three inside the hive (`Gothicvania/Environments/Living-Tissue-Platform-Files`: flesh walls and fangs), ending in the boss's chamber |
| Portraits | `Warped/Misc/Warped Portraits Files` (4 portraits, 48×48) |
| Effects | `Explosions and Magic/*`, marine bullets and impacts |

## 7. Success criteria for v1.0

- All 3 levels and bosses can be played start to finish; the owner finds it fun, hard but beatable.
- Holds 60 fps on a typical laptop in Chrome and Firefox.
- No console errors through a full playthrough.
- Released to production through the release script and listed as `live` on the portal.
- All CI and security checks green; no high-severity ZAP findings.

## 8. Open items

- Default key layout (M1/M2 play-test).
- Phone touch controls: button layout (M3.11). **Landscape only** (owner decision 2026-10-18): held upright, the game asks the player to turn the phone.
