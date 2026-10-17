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
| Levels | **3 levels, each ending in a boss** (owner decision 2026-10-17): 1 Industrial, 2 Cyberpunk Corridor, 3 Alien Hive. Built as side-scrolling tile maps. About 4–6 minutes per level |
| Player | The Warped space marine: idle, run, jump, crouch, shoot, die |
| Aiming | Forward (standing, running, jumping), crouched forward, and **diagonal up**. The diagonal frame is derived from the existing art by Claude. Aim poses are data in the asset manifest so better art can replace them later without code changes (owner decision 2026-10-17) |
| Controls | Keyboard and **gamepad** (standard mapping). Default keys: arrows or WASD to move, jump, fire, aim-up modifier, pause. Final key layout settled in M1/M2 play-tests |
| Health | **Health bar** with several hits per life, brief invulnerability after a hit, **mid-level checkpoints**, and a small number of lives with continue from the last checkpoint (owner decision 2026-10-17). Exact numbers live in `src/config/tuning.ts` |
| Enemies | Walking alien, flying alien, bipedal walker, alien creatures; enemy shots |
| Bosses | Level 1: **tank**. Level 2: **mech**. Level 3: an alien boss using **Gothicvania boss art (dragon or demon), recolored** to fit (owner approved 2026-10-17). Each with a health bar, phases and attack patterns |
| Weapons | Default rifle plus **2–3 weapon pickups** (e.g. spread, rapid, laser), introduced from Level 2 (owner approved 2026-10-17). Exact rules decided in M4 |
| Hazards | Pits and one-way platforms. No slopes in v1 |
| Story | **Minimal text**: one or two lines with a speaker portrait on the card between levels, plus intro and ending cards (owner decision 2026-10-17). Text lives in a data file |
| Audio | **CC0 sound effects plus one music loop per level** (owner decision 2026-10-17). Each source needs owner approval and is listed in `CREDITS.md` |
| Saving | Furthest level reached, best score, and volume settings in localStorage, safe if storage is unavailable |
| Screens | Title (with a link back to the portal), level intro card, game, pause, game over, continue, ending, credits |
| Display | 320×176 game area at native pixel size, scaled by whole numbers with sharp pixels (confirmed in M1.2) |

### Out of scope (v1)

- Two-player co-op
- Mobile and touch controls
- Full 8-way aiming and straight-up aiming (possible later with new art)
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
| Enemies | `Warped/Characters/alien-walking-enemy`, `alien-flying-enemy`, `bipedal-Unit` |
| Bosses | `Warped/Characters/tank-unit`, `mech-unit`, `Gothicvania/Characters/Grotto-escape-2-boss-dragon` or `demon-Files` |
| Level 1 Industrial | `Warped/Environments/parallax-industrial-web` (backgrounds) with tiles from `sci-fi-interior-platform` or `sci-fi-environment-background-files` (chosen in M3) |
| Level 2 Cyberpunk Corridor | `Warped/Environments/cyberpunk-corridor-files`, props from `cyberpunk-detective-props` |
| Level 3 Alien Hive | `Warped/Environments/alien-environment` |
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
- Level 1 tileset choice (M3).
- Platform art for the corridor, which has only a flat floor (M2.4).
- Weapon pickup set and rules (M4).
- Level 3 boss art: dragon or demon (M5).
- Specific CC0 audio sources (M3; each needs approval).
