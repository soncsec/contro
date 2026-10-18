"""Builds the steelworks tileset for Level 1 (owner chose option B, 2026-10-18).

Source: the Warped "bulkhead-walls" v1 layers, 352×224. The game is 176 px tall, so the top
48 px (ceiling) are cut off. Tileset layout (352×224, 16 px tiles, 22 columns):
  rows 0–10   the back layer, rows 3–13: steel wall (rows 0–7) and floor (rows 8–10). The
              floor plate's top edge is row 8's top; feet stand 8 px into it.
  rows 11–13  the scaffold walkway layer, source y 80–127 (transparent background): the deck
              is the top 11 px of row 11, ladder legs below it repeat every 16 px.
  row 14      pit tiles drawn in the floor's own colours: shaft, left wall, right wall (a lit
              rim where the floor is cut), and the shaft's top with the cut plate's edge.
  rows 15–22  the wall of rows 0–7 with the pack's support columns and pipes layered on top
              (for indoor sections, M3.1 1-2).
Rows 0–13 and 15–22 are cropped, stacked and layered with no pixels changed; row 14 is drawn
by Claude.
Used by build_assets.py ("steelworks").
"""
import png

CROP_TOP = 48  # source rows above this are ceiling
TILE = 16
SHAFT = (10, 14, 16, 255)  # darker than the floor's darkest (16, 24, 24)
SHAFT_MID = (16, 24, 24, 255)
RIM = (59, 83, 89, 255)  # the floor's highlight
RIM_DARK = (34, 43, 41, 255)
WALKWAY_TOP, WALKWAY_BOTTOM = 80, 128


WALL_BOTTOM = CROP_TOP + 8 * TILE  # the wall is the 8 tile rows above the floor


def over(base: png.Image, top: png.Image) -> png.Image:
    """Lays top's opaque pixels over base (the pack's layers are fully opaque or clear)."""
    return [[t if t[3] == 255 else b for b, t in zip(rb, rt)] for rb, rt in zip(base, top)]


def build(back_path: str, walkway_path: str, cols_path: str, pipes_path: str) -> png.Image:
    back = png.read(back_path)
    walkway = png.read(walkway_path)
    cols = png.read(cols_path)
    pipes = png.read(pipes_path)
    if len({len(img[0]) for img in (back, walkway, cols, pipes)}) != 1:
        raise ValueError("layers differ in width")
    if any(p[3] not in (0, 255) for img in (cols, pipes) for r in img for p in r):
        raise ValueError("expected fully opaque or clear pixels in the column and pipe layers")
    width = len(back[0])
    piped = over(over(back, cols), pipes)
    return (
        [list(r) for r in back[CROP_TOP:]]
        + [list(r) for r in walkway[WALKWAY_TOP:WALKWAY_BOTTOM]]
        + pit_row(width)
        + [list(r) for r in piped[CROP_TOP:WALL_BOTTOM]]
    )


STEEL_PIT = (SHAFT, SHAFT_MID, RIM, RIM_DARK)


def pit_tile(kind: str, colours: tuple = STEEL_PIT) -> list[list[tuple[int, int, int, int]]]:
    """kind: 'shaft', 'left' (the floor's cut face on the left), 'right'.
    colours: (shaft, shaft top, rim, rim shadow)."""
    SHAFT, SHAFT_MID, RIM, RIM_DARK = colours  # noqa: N806 (shadows the module colours)
    tile = [[SHAFT] * TILE for _ in range(TILE)]
    for y in range(TILE):
        for x in range(TILE):
            # A faint vertical gradient so the shaft isn't a flat hole.
            if y < 4:
                tile[y][x] = SHAFT_MID
            if kind == "left" and x < 2:
                tile[y][x] = RIM if x == 0 else RIM_DARK
            if kind == "right" and x > TILE - 3:
                tile[y][x] = RIM if x == TILE - 1 else RIM_DARK
    return tile


def pit_row(width: int, colours: tuple = STEEL_PIT) -> list[list[tuple[int, int, int, int]]]:
    tiles = [pit_tile(k, colours) for k in ("shaft", "left", "right")]
    clear = (0, 0, 0, 0)
    return [
        [px for t in tiles for px in t[y]] + [clear] * (width - TILE * len(tiles))
        for y in range(TILE)
    ]
