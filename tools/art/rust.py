"""Builds the rust factory tileset for Level 1 (owner chose option C for variety, 2026-10-18).

Source: the Warped "bulkhead-walls" v2 PNGs, plus the v1 scaffold walkway recoloured. The
tileset has the same rows as the steelworks one (tools/art/steelworks.py), so the section
generator lays both out the same way. 288×368, 16 px tiles, 18 columns (two 144 px wall bays):
  rows 0–7    the wall with its supports and lamps, source y 77–204: the 128 px above the
              floor (the ceiling is cut off). Pixels unchanged.
  row 8       the floor plate, the top 16 rows of floor.png, repeated. Pixels unchanged.
  rows 9–10   the face under the floor: dark panels drawn by Claude in the wall's colours.
  rows 11–13  the v1 scaffold walkway (source y 80–127), each colour swapped for one from the
              v2 art (RECOLOUR), so it reads as rusted iron. Derived.
  row 14      pit tiles drawn by Claude in the rust colours (steelworks.pit_row).
  rows 15–22  the wall again (indoor sections use these rows).
Used by build_assets.py ("rust").
"""
import png
import steelworks

TILE = 16
COLUMNS = 18
WIDTH = COLUMNS * TILE
WALL_TOP, WALL_BOTTOM = 77, 205  # floor.png sits at y 205 in the pack's preview
WALKWAY_TOP, WALKWAY_BOTTOM = 80, 128

DARK = (26, 22, 16, 255)
SEAM = (34, 30, 21, 255)
EDGE = (41, 34, 24, 255)
RIVET = (56, 41, 29, 255)
RUST_PIT = ((14, 12, 9, 255), DARK, (107, 81, 48, 255), (44, 35, 26, 255))

# The walkway's teal colours, darkest first, each to a v2 colour of similar brightness.
RECOLOUR = {
    (0, 8, 8, 255): (26, 22, 16, 255),
    (16, 24, 24, 255): (34, 30, 21, 255),
    (24, 37, 36, 255): (47, 18, 11, 255),
    (28, 36, 36, 255): (41, 34, 24, 255),
    (32, 44, 37, 255): (44, 35, 26, 255),
    (34, 51, 50, 255): (70, 39, 15, 255),
    (40, 48, 48, 255): (56, 41, 29, 255),
    (38, 56, 46, 255): (68, 55, 39, 255),
    (44, 55, 53, 255): (71, 49, 36, 255),
    (56, 72, 72, 255): (94, 58, 39, 255),
    (46, 81, 79, 255): (117, 52, 14, 255),
    (68, 89, 83, 255): (128, 74, 45, 255),
    (61, 105, 103, 255): (150, 84, 28, 255),
    (95, 142, 140, 255): (189, 145, 96, 255),
}


def tiled(rows: png.Image, width: int) -> png.Image:
    """Repeats rows sideways to width."""
    return [[r[x % len(r)] for x in range(width)] for r in rows]


def underfloor() -> png.Image:
    """Two tile rows of dark panels: a seam along the top, uprights every 48 px, rivets."""
    rows = []
    for y in range(2 * TILE):
        row = []
        for x in range(WIDTH):
            px = DARK
            if y in (0, TILE):
                px = SEAM
            if x % 48 in (0, 47):
                px = EDGE
            if y % TILE in (3, 12) and x % 48 in (3, 44):
                px = RIVET
            row.append(px)
        rows.append(row)
    return rows


def recolour(rows: png.Image) -> png.Image:
    out = []
    for r in rows:
        line = []
        for p in r:
            if p[3] == 0:
                line.append((0, 0, 0, 0))
            elif p in RECOLOUR:
                line.append(RECOLOUR[p])
            else:
                raise ValueError(f"walkway colour {p} has no rust colour")
        out.append(line)
    return out


def build(wall_path: str, floor_path: str, walkway_path: str) -> png.Image:
    wall = png.read(wall_path)
    floor = png.read(floor_path)
    walkway = png.read(walkway_path)
    if WIDTH % len(wall[0]) or WIDTH % len(floor[0]):
        raise ValueError("the wall and floor must repeat evenly across the tileset")
    wall_rows = tiled(wall[WALL_TOP:WALL_BOTTOM], WIDTH)
    return (
        wall_rows
        + tiled(floor[:TILE], WIDTH)
        + underfloor()
        + recolour([r[:WIDTH] for r in walkway[WALKWAY_TOP:WALKWAY_BOTTOM]])
        + steelworks.pit_row(WIDTH, RUST_PIT)
        + [list(r) for r in wall_rows]
    )
