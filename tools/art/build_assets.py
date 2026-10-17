#!/usr/bin/env python3
"""Builds public/assets/ from the read-only legacy/ art pack and updates CREDITS.md.

Run from the repo root:  python3 tools/art/build_assets.py

Each entry either copies a file unchanged or packs numbered frame files into one
horizontal sprite sheet (ARCHITECTURE.md ADR-C04). The output is committed; the
legacy pack is not, so CI checks the results (tests/unit/manifest.test.ts and
scripts/check_repo.py) rather than rerunning this script.
"""
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import png  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
LEGACY = ROOT / "legacy"
PUBLIC = ROOT / "public"
CREDITS = ROOT / "CREDITS.md"
START, END = "<!-- assets:start -->", "<!-- assets:end -->"

MARINE = "Warped/Characters/space-marine-lite/Sprites"

# (output under public/, source under legacy/, how)
#   how = "copy"           copy the file unchanged
#   how = "pack:<glob>"    pack the numbered frames matching <glob> inside the source folder
#   how = "flash:<glob>"   cut the muzzle flash (flash colours inside FLASH_BOX) out of each
#                          numbered frame and pack them; derived art (ADR-C04)
ASSETS = [
    ("assets/player/marine-idle.png", f"{MARINE}/Idle Gun/sprites", "pack:idle-gun*.png"),
    ("assets/player/marine-run.png", f"{MARINE}/Run with Gun/sprites", "pack:run-with-gun*.png"),
    ("assets/player/marine-jump.png", f"{MARINE}/Jump with Gun/sprites", "pack:jump-with-gun*.png"),
    ("assets/player/marine-shoot.png", f"{MARINE}/Shoot/sprites", "pack:shoot*.png"),
    ("assets/player/marine-crouch.png", f"{MARINE}/Crouch Gun/sprites", "pack:crouch-gun*.png"),
    ("assets/player/marine-crouch-shoot.png", f"{MARINE}/Crouch Shoot/sprites", "pack:crouch-shoot*.png"),
    ("assets/player/marine-die.png", f"{MARINE}/Die/sprites", "pack:die*.png"),
    ("assets/effects/bullet.png", f"{MARINE}/Misc", "pack:bullet*.png"),
    ("assets/effects/muzzle-flash.png", f"{MARINE}/Shoot/sprites", "flash:shoot*.png"),
    ("assets/effects/wall-impact.png", f"{MARINE}/Misc", "pack:wall-impact-blast*.png"),
    ("assets/effects/enemy-death.png", "Explosions and Magic/EnemyDeath/spritesheet.png", "copy"),
    ("assets/effects/hit.png", "Explosions and Magic/Hit/hit.png", "copy"),
    ("assets/enemies/alien-walker-idle.png", "Warped/Characters/alien-walking-enemy/Spritesheets/alien-enemy-idle.png", "copy"),
    ("assets/enemies/alien-walker-walk.png", "Warped/Characters/alien-walking-enemy/Spritesheets/alien-enemy-walk.png", "copy"),
    ("assets/levels/corridor/back.png", "Warped/Environments/cyberpunk-corridor-files/PNG/back.png", "copy"),
    ("assets/levels/corridor/foreground.png", "Warped/Environments/cyberpunk-corridor-files/PNG/cyberpunk-corridor-foreground.png", "copy"),
    ("assets/levels/corridor/tileset.png", "Warped/Environments/cyberpunk-corridor-files/PNG/cyberpunk-corridor.png", "copy"),
]


# The flash in the marine's shoot frames: these colours, inside this box (x0, y0, x1, y1).
FLASH_COLOURS = {(255, 156, 42), (255, 235, 162), (255, 85, 0)}
FLASH_BOX = (50, 16, 71, 31)


def cut_flash(img: png.Image) -> png.Image:
    x0, y0, x1, y1 = FLASH_BOX
    clear = (0, 0, 0, 0)
    return [
        [img[y][x] if img[y][x][3] and img[y][x][:3] in FLASH_COLOURS else clear for x in range(x0, x1 + 1)]
        for y in range(y0, y1 + 1)
    ]


def frame_number(path: pathlib.Path) -> int:
    match = re.search(r"(\d+)\.png$", path.name)
    if not match:
        raise ValueError(f"frame file has no number: {path}")
    return int(match.group(1))


def build() -> list[tuple[str, str, str]]:
    rows = []
    for out, src, how in ASSETS:
        dest = PUBLIC / out
        dest.parent.mkdir(parents=True, exist_ok=True)
        source = LEGACY / src
        if how == "copy":
            dest.write_bytes(source.read_bytes())
            rows.append((out, src, "unchanged"))
        else:
            kind, pattern = how.split(":", 1)
            frames = sorted(source.glob(pattern), key=frame_number)
            if not frames:
                raise FileNotFoundError(f"no frames match {pattern} in {source}")
            images = [png.read(str(f)) for f in frames]
            if kind == "flash":
                images = [cut_flash(i) for i in images]
                note = f"*derived*: muzzle flash cut out of {len(frames)} frames, packed into a strip"
            else:
                note = f"{len(frames)} frames packed into a strip"
            png.write(str(dest), png.strip(images))
            first, last = frames[0].name, frames[-1].name
            rows.append((out, f"{src}/{first} … {last}", note))
        print(f"wrote public/{out}")
    return rows


def update_credits(rows: list[tuple[str, str, str]]) -> None:
    table = "\n".join(f"| `{out}` | `{src}` | {note} |" for out, src, note in rows)
    text = CREDITS.read_text()
    if START not in text or END not in text:
        raise SystemExit(f"CREDITS.md needs the {START} and {END} markers")
    head, rest = text.split(START, 1)
    _, tail = rest.split(END, 1)
    CREDITS.write_text(f"{head}{START}\n{table}\n{END}{tail}")


if __name__ == "__main__":
    if not LEGACY.is_dir():
        raise SystemExit("legacy/ not found: link it to ~/dev/games/_assets/legacy first")
    update_credits(build())
