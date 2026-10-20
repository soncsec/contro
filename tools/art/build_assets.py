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
import aim  # noqa: E402
import blimp  # noqa: E402
import catwalk  # noqa: E402
import letters  # noqa: E402
import neon  # noqa: E402
import props  # noqa: E402
import rust  # noqa: E402
import steelworks  # noqa: E402
import png  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
LEGACY = ROOT / "legacy"
PUBLIC = ROOT / "public"
CREDITS = ROOT / "CREDITS.md"
MUZZLES_TS = ROOT / "src" / "assets" / "aimMuzzles.generated.ts"
START, END = "<!-- assets:start -->", "<!-- assets:end -->"

MARINE = "Warped/Characters/space-marine-lite/Sprites"
PORTRAITS = "Warped/Misc/Warped Portraits Files/portraits with bg"

# (output under public/, source under legacy/, how)
#   how = "copy"           copy the file unchanged
#   how = "pack:<glob>"    pack the numbered frames matching <glob> inside the source folder
#   how = "flash:<glob>"   cut the muzzle flash (flash colours inside FLASH_BOX) out of each
#                          numbered frame and pack them; derived art (ADR-C04)
#   how = "aim:<glob>"     raise the arms and rifle of each numbered frame 45° (tools/art/aim.py)
#                          and pack them; the new barrel tips go to the generated muzzle file
#   how = "aimbare:<glob>" the same, with any muzzle flash removed
#   how = "aimdown:<glob>" lower the arms and rifle 45° instead (M3.13), with no muzzle flash
#   how = "rot45:<glob>:WxH" rotate each frame 45° up onto a W×H canvas (bullets, flashes)
#   how = "draw:catwalk"   new tiles drawn by tools/art/catwalk.py in the colours of the source
#   how = "steelworks"     crop and stack the bulkhead-walls v1 layers (tools/art/steelworks.py)
#   how = "rust"           the bulkhead-walls v2 wall and floor, rust walkway (tools/art/rust.py)
ASSETS = [
    ("assets/player/marine-idle.png", f"{MARINE}/Idle Gun/sprites", "pack:idle-gun*.png"),
    ("assets/player/marine-run.png", f"{MARINE}/Run with Gun/sprites", "pack:run-with-gun*.png"),
    ("assets/player/marine-jump.png", f"{MARINE}/Jump with Gun/sprites", "pack:jump-with-gun*.png"),
    ("assets/player/marine-shoot.png", f"{MARINE}/Shoot/sprites", "pack:shoot*.png"),
    ("assets/player/marine-crouch.png", f"{MARINE}/Crouch Gun/sprites", "pack:crouch-gun*.png"),
    ("assets/player/marine-crouch-shoot.png", f"{MARINE}/Crouch Shoot/sprites", "pack:crouch-shoot*.png"),
    ("assets/player/marine-die.png", f"{MARINE}/Die/sprites", "pack:die*.png"),
    ("assets/player/marine-aim-diag.png", f"{MARINE}/Idle Gun/sprites", "aimbare:idle-gun*.png"),
    ("assets/player/marine-shoot-diag.png", f"{MARINE}/Shoot/sprites", "aim:shoot*.png"),
    ("assets/player/marine-run-diag.png", f"{MARINE}/Run with Gun/sprites", "aim:run-with-gun*.png"),
    ("assets/player/marine-run-down.png", f"{MARINE}/Run with Gun/sprites", "aimdown:run-with-gun*.png"),
    ("assets/effects/bullet.png", f"{MARINE}/Misc", "pack:bullet*.png"),
    ("assets/effects/muzzle-flash.png", f"{MARINE}/Shoot/sprites", "flash:shoot*.png"),
    ("assets/effects/muzzle-flash-diag.png", f"{MARINE}/Shoot/sprites", "rot45flash:shoot*.png:24x24"),
    ("assets/effects/bullet-diag.png", f"{MARINE}/Misc", "rot45:bullet*.png:10x10"),
    ("assets/effects/enemy-death.png", "Explosions and Magic/EnemyDeath/spritesheet.png", "copy"),
    ("assets/effects/air-jump-ring.png", "Explosions and Magic/Grotto-escape-2-FX/spritesheets/slash-circular.png", "copy"),
    ("assets/effects/hit.png", "Explosions and Magic/Hit/hit.png", "copy"),
    # Level 1 boss (M3.3): the tank, and the big explosion it goes up in
    ("assets/enemies/tank.png", "Warped/Characters/tank-unit/Spritesheet.png", "copy"),
    # M4.2: the bipedal walker, seven walk frames (owner approved the art 2026-10-19)
    ("assets/enemies/bipedal-walk.png", "Warped/Characters/bipedal-Unit/sprites", "pack:bipedal-unit*.png"),
    # M4.4: the Level 2 boss, the mech, ten walk frames (design approved 2026-10-19)
    ("assets/enemies/mech.png", "Warped/Characters/mech-unit/sprites", "pack:mech-unit-export*.png"),
    ("assets/effects/ground-explosion.png", "Explosions and Magic/Ground Explosion/spritesheet/explosion-animation.png", "copy"),
    ("assets/enemies/alien-flyer.png", "Warped/Characters/alien-flying-enemy/spritesheet.png", "copy"),
    ("assets/effects/enemy-shot.png", "Gothicvania/Misc/EnemyProjectile/spritesheet.png", "copy"),
    ("assets/enemies/alien-walker-idle.png", "Warped/Characters/alien-walking-enemy/Spritesheets/alien-enemy-idle.png", "copy"),
    ("assets/enemies/alien-walker-walk.png", "Warped/Characters/alien-walking-enemy/Spritesheets/alien-enemy-walk.png", "copy"),
    ("assets/portraits/commander.png", f"{PORTRAITS}/base1.png", "copy"),
    ("assets/portraits/ops.png", f"{PORTRAITS}/base2.png", "copy"),
    ("assets/portraits/marine.png", f"{PORTRAITS}/base3.png", "copy"),
    ("assets/portraits/hive.png", f"{PORTRAITS}/base4.png", "copy"),
    ("assets/levels/corridor/back.png", "Warped/Environments/cyberpunk-corridor-files/PNG/back.png", "copy"),
    ("assets/levels/corridor/foreground.png", "Warped/Environments/cyberpunk-corridor-files/PNG/cyberpunk-corridor-foreground.png", "copy"),
    # M4.1 weapon pickups: the blimp that carries them and the letters it drops (drawn by Claude)
    ("assets/enemies/blimp.png", "", "draw:blimp"),
    ("assets/enemies/blimp-left.png", "", "draw:blimp-left"),
    ("assets/effects/pickup-machine-gun.png", "", "draw:letter-M"),
    ("assets/effects/pickup-spread.png", "", "draw:letter-S"),
    ("assets/effects/pickup-health.png", "", "draw:letter-+"),
    # Level 2, the Neon District (owner chose option A, 2026-10-19): tileset and skyline
    ("assets/levels/neon/tileset.png", "Warped/Environments", "neon"),
    ("assets/levels/corridor/props.png", "Warped/Environments/cyberpunk-detective-props/PNG", "props"),
    ("assets/levels/neon/sky.png", "Warped/Environments/Synth City/city skyline/Layers/back.png", "copy"),
    ("assets/levels/neon/buildings.png", "Warped/Environments/Synth City/city skyline/Layers/buildings.png", "copy"),
    ("assets/levels/neon/front.png", "Warped/Environments/Synth City/city skyline/Layers/front.png", "copy"),
    ("assets/levels/corridor/catwalk.png", "Warped/Environments/cyberpunk-corridor-files/PNG/cyberpunk-corridor.png", "draw:catwalk"),
    ("assets/levels/corridor/tileset.png", "Warped/Environments/cyberpunk-corridor-files/PNG/cyberpunk-corridor.png", "copy"),
    # Level 1 Industrial (owner chose option B, teal steelworks, 2026-10-18)
    ("assets/levels/steelworks/tileset.png", "Warped/Environments/bulkhead-walls/v1/layers", "steelworks"),
    # Level 1 rust factory rooms (option C, for variety)
    ("assets/levels/rust/tileset.png", "Warped/Environments/bulkhead-walls", "rust"),
    ("assets/levels/industrial/sky.png", "Warped/Environments/parallax-industrial-web/Layers/bg.png", "copy"),
    ("assets/levels/industrial/far.png", "Warped/Environments/parallax-industrial-web/Layers/far-buildings.png", "copy"),
    ("assets/levels/industrial/mid.png", "Warped/Environments/parallax-industrial-web/Layers/buildings.png", "copy"),
    ("assets/levels/industrial/near.png", "Warped/Environments/parallax-industrial-web/Layers/skill-foreground.png", "copy"),
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


muzzles: dict[str, list[tuple[int, int]]] = {}


def write_muzzles() -> None:
    lines = [
        "// Generated by tools/art/build_assets.py: do not edit by hand.",
        "// Barrel tip [x, y] in each frame of the derived diagonal-aim sheets (facing right).",
        "export const AIM_MUZZLES: Readonly<Record<string, readonly (readonly [number, number])[]>> = {",
    ]
    for key in sorted(muzzles):
        points = ", ".join(f"[{x}, {y}]" for x, y in muzzles[key])
        lines.append(f"  '{key}': [{points}],")
    lines.append("};")
    MUZZLES_TS.write_text("\n".join(lines) + "\n")
    print(f"wrote {MUZZLES_TS.relative_to(ROOT)}")


def build() -> list[tuple[str, str, str]]:
    rows = []
    for out, src, how in ASSETS:
        dest = PUBLIC / out
        dest.parent.mkdir(parents=True, exist_ok=True)
        source = LEGACY / src
        if how == "copy":
            dest.write_bytes(source.read_bytes())
            rows.append((out, src, "unchanged"))
        elif how == "steelworks":
            png.write(str(dest), steelworks.build(str(source / "bulkhead-walls-back.png"), str(source / "bulkhead-walls-platform.png"), str(source / "cols.png"), str(source / "bulkhead-walls-pipes.png")))
            rows.append((out, f"{src}/bulkhead-walls-back.png, bulkhead-walls-platform.png, cols.png, bulkhead-walls-pipes.png", "*derived*: ceiling cropped off, wall and floor stacked with the scaffold walkway and a copy of the wall with the columns and pipes layered on, pixels unchanged; plus pit tiles *drawn by Claude* in the floor's colours (`tools/art/steelworks.py`)"))
        elif how == "rust":
            png.write(str(dest), rust.build(str(source / "v2/PNG/bg-wall-with-supports.png"), str(source / "v2/PNG/floor.png"), str(source / "v1/layers/bulkhead-walls-platform.png")))
            rows.append((out, f"{src}/v2/PNG/bg-wall-with-supports.png, v2/PNG/floor.png, v1/layers/bulkhead-walls-platform.png", "*derived*: v2 wall (ceiling cropped off) and floor, pixels unchanged; the v1 scaffold walkway recoloured with v2 colours; under-floor panels and pit tiles *drawn by Claude* in the v2 colours (`tools/art/rust.py`)"))
        elif how in ("draw:blimp", "draw:blimp-left"):
            png.write(str(dest), blimp.build(left_facing=how.endswith("left")))
            rows.append((out, "—", "*drawn by Claude* (`tools/art/blimp.py`): the weapon blimp, 2 frames (owner approved the design 2026-10-19)"))
        elif how.startswith("draw:letter-"):
            letter = how.split("-", 1)[1]
            png.write(str(dest), letters.build(letter))
            rows.append((out, "—", f"*drawn by Claude* (`tools/art/letters.py`): the {letter} pickup, in the style of Press Start 2P (owner approved 2026-10-19)"))
        elif how == "props":
            png.write(str(dest), props.build(str(source)))
            rows.append((out, f"{src}/cryo-pod.png, server-gabinetes.png, small-terminal.png", "*derived*: three props placed on a 16 px grid, bottom-aligned, pixels unchanged (`tools/art/props.py`)"))
        elif how == "neon":
            png.write(str(dest), neon.build(str(source / "sci-fi-interior-platform/PNG/tile-set-sci-fi-interior-platform.png"), str(source / "Scifi lab Files/layers")))
            rows.append((out, f"{src}/sci-fi-interior-platform/PNG/tile-set-sci-fi-interior-platform.png, Scifi lab Files/layers/*.png", "*derived*: the platform tiles' ledge strip and lattice cut and repeated as floor, face and walkway; the lab's three layers flattened as the wall; pit tiles *drawn by Claude* in the lattice's colours (`tools/art/neon.py`)"))
        elif how == "draw:catwalk":
            png.write(str(dest), catwalk.build(str(source)))
            rows.append((out, src, "*drawn by Claude* (`tools/art/catwalk.py`): catwalk and pit tiles in this tileset's colours, pit edges reuse its floor pixels"))
        else:
            kind, pattern = how.split(":", 1)
            size = None
            if kind.startswith("rot45"):
                pattern, size = pattern.rsplit(":", 1)
            frames = sorted(source.glob(pattern), key=frame_number)
            if not frames:
                raise FileNotFoundError(f"no frames match {pattern} in {source}")
            images = [png.read(str(f)) for f in frames]
            if kind == "flash":
                images = [cut_flash(i) for i in images]
                note = f"*derived*: muzzle flash cut out of {len(frames)} frames, packed into a strip"
            elif kind in ("aim", "aimbare", "aimdown"):
                down = kind == "aimdown"
                degrees = aim.DIAGONAL_DOWN if down else aim.DIAGONAL
                done = [aim.aim_frame(i, keep_flash=kind == "aim", degrees=degrees) for i in images]
                images = [img for img, _ in done]
                muzzles[pathlib.Path(out).stem] = [tip for _, tip in done]
                way = "lowered" if down else "raised"
                note = f"*derived*: arms and rifle {way} 45° in {len(frames)} frames (`tools/art/aim.py`)"
            elif kind in ("rot45", "rot45flash"):
                assert size is not None
                w, h = (int(v) for v in size.split("x"))
                base = [png.read(str(f)) for f in frames]
                if kind == "rot45flash":
                    base = [cut_flash(i) for i in base]
                images = [aim.rotate_whole(i, aim.DIAGONAL, (w, h)) for i in base]
                note = f"*derived*: {len(frames)} frames rotated 45° up (`tools/art/aim.py`)"
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
    write_muzzles()
