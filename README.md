# Contro

A sci-fi run-and-gun platformer for the browser, in the style of Contra. A space marine fights through an industrial zone, a cyberpunk corridor and an alien hive.

Part of the Soncrant Arcade at `games.soncrant.com/contro/`.

- Product scope: [PROJECT.md](PROJECT.md)
- Technical design: [ARCHITECTURE.md](ARCHITECTURE.md)
- Milestones and progress: [ROADMAP.md](ROADMAP.md)
- Development rules: [CLAUDE.md](CLAUDE.md)

Art: Ansimuz Legacy Collection (CC0). See CREDITS.md once assets are added.

## Play

- Production: http://games.soncrant.com/contro/
- Staging (every merge to `main`): https://soncsec.github.io/contro/

Keys: arrows or WASD to move (up aims, down crouches), Space/Z/K to jump, X/J to fire, Esc/P to pause, F for fullscreen.
Gamepad (standard mapping): d-pad or left stick, A to jump, X or B to fire, Start to pause.

## Release

```
scripts/release.sh deploy [--dry-run]   # needs main checked out and every CI check (incl. ZAP) passed
scripts/release.sh rollback             # back to the previous release
scripts/release.sh status               # list releases on the server
gh workflow run "Production check" -R soncsec/contro   # smoke test + ZAP from outside the network
```

Server settings live in the git-ignored `deploy/server.env` (see `deploy/server.env.example`).
