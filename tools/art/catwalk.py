"""Draws the corridor catwalk and pit tiles (owner's choice, option C, 2026-10-17).

Tileset layout (48×48, 16 px tiles):
  row 0      catwalk left end, middle, right end. Rails in rows 0–6, deck from row 7
             (the walkable top), under-truss in rows 13–15.
  rows 1–2   pit left edge, middle, right edge, each 16×32: the corridor floor plane
             (y 144–175 in a room) cut away to a dark shaft with a neon lip.

All colours are sampled from the Warped cyberpunk corridor tileset, and the pit edges reuse
its real floor pixels, so the new tiles sit in the room's palette. Drawn by Claude;
used by build_assets.py ("draw:catwalk").
"""
import png

CLEAR = (0, 0, 0, 0)
BASE = (0, 26, 34, 255)
DARK = (0, 4, 16, 255)
MID = (0, 14, 27, 255)
HI = (0, 40, 44, 255)
HI2 = (0, 64, 64, 255)
NEON = (0, 231, 211, 255)
VOID = (2, 2, 8, 255)
VOID_LIGHT = (0, 10, 20, 255)

TILE = 16
DECK_TOP = 7  # first walkable row of a catwalk tile


def catwalk_tile(kind: str) -> png.Image:
    """kind: 'left', 'middle' or 'right'."""
    t = [[CLEAR] * TILE for _ in range(TILE)]
    # Rail: top bar, a thinner mid bar, and posts.
    for x in range(TILE):
        t[0][x] = HI2
        t[1][x] = MID
        t[4][x] = HI
    posts = {2, 10} if kind == "middle" else ({1, 10} if kind == "left" else {2, 14})
    for x in posts:
        for y in range(0, DECK_TOP):
            t[y][x] = HI if y else HI2
    # Deck: neon edge, highlight, face with seams and rivets, shadowed underside.
    for x in range(TILE):
        t[DECK_TOP][x] = NEON
        t[DECK_TOP + 1][x] = HI2
        for y in range(DECK_TOP + 2, 13):
            t[y][x] = BASE
        t[12][x] = MID
    for y in range(DECK_TOP + 2, 12):
        t[y][15] = DARK  # plate seam every tile
    t[10][4] = HI
    t[10][11] = HI
    # Under-truss: a small V brace in each tile.
    for i, y in enumerate(range(13, 16)):
        for x in (3 + i, 12 - i):
            t[y][x] = MID
    # End caps: a dark bevel and the neon edge stopping one pixel short.
    if kind == "left":
        for y in range(DECK_TOP, 13):
            t[y][0] = DARK
        t[DECK_TOP][0] = HI
    if kind == "right":
        for y in range(DECK_TOP, 13):
            t[y][15] = DARK
        t[DECK_TOP][15] = HI
    return t


def pit_column(kind: str, floor: png.Image) -> png.Image:
    """16×32 pit tile. `floor` is a 16×32 sample of the corridor floor (y 144–175)."""
    t = [[VOID] * TILE for _ in range(2 * TILE)]
    for y in range(2 * TILE):
        for x in range(TILE):
            if y < 3:
                t[y][x] = VOID_LIGHT  # faint light from the room catching the shaft's rim
    if kind == "middle":
        return t
    # Edge: floor on the solid side, a lit metal lip, then the drop.
    for y in range(2 * TILE):
        for x in range(TILE):
            solid_x = x if kind == "left" else TILE - 1 - x
            if solid_x <= 9:
                t[y][x] = floor[y][x]
            elif solid_x == 10:
                t[y][x] = HI2
            elif solid_x == 11:
                t[y][x] = NEON if y < 6 else (HI if y < 18 else MID)
            elif solid_x == 12:
                t[y][x] = DARK
    return t


def build(corridor_tileset: str) -> png.Image:
    """The 48×48 catwalk tileset. Takes the floor sample from the panels section of the
    corridor tileset (columns 1–7, room rows 9–10 = tileset y 160–191)."""
    src = png.read(corridor_tileset)
    floor = [row[2 * TILE : 3 * TILE] for row in src[10 * TILE : 12 * TILE]]
    tiles = [catwalk_tile(k) for k in ("left", "middle", "right")]
    pits = [pit_column(k, floor) for k in ("left", "middle", "right")]
    sheet = [[CLEAR] * (3 * TILE) for _ in range(3 * TILE)]
    for i, t in enumerate(tiles):
        for y in range(TILE):
            for x in range(TILE):
                sheet[y][i * TILE + x] = t[y][x]
    for i, p in enumerate(pits):
        for y in range(2 * TILE):
            for x in range(TILE):
                sheet[TILE + y][i * TILE + x] = p[y][x]
    return sheet
