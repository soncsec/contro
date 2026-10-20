"""Builds the Neon District tileset for Level 2 (owner chose option A, 2026-10-19).

Sources: the Warped "sci-fi-interior-platform" tiles (floor strip, lattice) and the "Scifi lab"
layers (the wall, for indoor sections). Same rows as the steelworks tileset
(tools/art/steelworks.py), so tools/levels/steelworks_section.py lays it out the same way.
320×368, 16 px tiles, 20 columns:
  rows 0–7    the lab wall: its back, middle and front layers flattened, source y 40–167.
  row 8       the floor plate: the platform tiles' long ledge strip, its middle 64 px repeated.
  rows 9–10   the face under the floor: the platform tiles' crossed lattice, repeated.
  rows 11–13  a one-way walkway: the strip again as the deck (ends cut from the strip's ends),
              with lattice legs. Derived (cut and stacked, pixels unchanged).
  row 14      pit tiles drawn by Claude in the lattice's colours (steelworks.pit_row).
  rows 15–22  the lab wall again (indoor sections use these rows).
Used by build_assets.py ("neon").
"""
import png
import steelworks

TILE = 16
COLUMNS = 20
WIDTH = COLUMNS * TILE
CLEAR = (0, 0, 0, 0)
NEON_PIT = ((13, 8, 22, 255), (24, 14, 34, 255), (178, 108, 74, 255), (88, 44, 58, 255))


def crop(img: png.Image, x: int, y: int, w: int, h: int) -> png.Image:
    return [list(r[x : x + w]) for r in img[y : y + h]]


def over(base: png.Image, top: png.Image) -> png.Image:
    return [[t if t[3] else b for b, t in zip(br, tr)] for br, tr in zip(base, top)]


def repeat_x(piece: png.Image, width: int) -> png.Image:
    w = len(piece[0])
    return [[row[x % w] for x in range(width)] for row in piece]


def build(platform_path: str, lab_dir: str) -> png.Image:
    tiles = png.read(platform_path)
    strip = crop(tiles, 32, 48, 96, 16)  # the long ledge, with its two ends
    middle = crop(strip, 16, 0, 64, 16)
    lattice = crop(tiles, 176, 128, 32, 32)
    lab = png.read(f"{lab_dir}/back.png")
    for name in ("middle", "front"):
        lab = over(lab, png.read(f"{lab_dir}/{name}.png"))
    wall = crop(lab, 0, 40, WIDTH, 128)
    floor = repeat_x(middle, WIDTH)
    face = repeat_x(lattice, WIDTH)
    # Walkway rows: deck tiles in the columns the generator uses (3 left end, 10 middle,
    # 17 right end, 15–16 above the legs), legs (lattice halves) under columns 15–16.
    deck = [[CLEAR] * WIDTH for _ in range(TILE * 3)]

    def put(col: int, row: int, tile: png.Image) -> None:
        for y in range(TILE):
            for x in range(TILE):
                deck[row * TILE + y][col * TILE + x] = tile[y][x]

    put(3, 0, crop(strip, 0, 0, TILE, TILE))
    put(10, 0, crop(strip, 32, 0, TILE, TILE))
    put(17, 0, crop(strip, 80, 0, TILE, TILE))
    for col in (15, 16):
        put(col, 0, crop(strip, 32, 0, TILE, TILE))
        put(col, 1, crop(lattice, (col - 15) * TILE, 0, TILE, TILE))
        put(col, 2, crop(lattice, (col - 15) * TILE, TILE, TILE, TILE))
    return wall + floor + face + deck + steelworks.pit_row(WIDTH, NEON_PIT) + wall
