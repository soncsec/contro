"""Builds the living-tissue tileset for Level 3's hive sections (owner chose "into the hive",
2026-10-20: after the alien base and its core, three sections inside the hive).

Source: the Gothicvania "Living-Tissue-Platform" layers (tileset 288×192, background 144×144):
flesh ledges with a lit crest, veined flesh under them. Same rows as the steelworks tileset
(tools/art/steelworks.py), so tools/levels/steelworks_section.py lays it out the same way.
320×368, 16 px tiles, 20 columns:
  rows 0–7    the hive's flesh wall: the background repeated (indoor sections use it).
  row 8       the floor: the ledge's crest (source y 108–123), its middle 64 px repeated; the
              crest's top sits 4 px into the tile.
  rows 9–10   under the floor: the veined flesh below the crest, the same 64 px repeated.
  rows 11–13  a one-way walkway: the crest as the deck (its rounded ends from the ledge's ends;
              the left end starts 11 px into its tile, as the generator expects); the legs are a
              flesh pillar made of the ledge's two outlined ends.
  row 14      pit tiles: the bottom of the flesh wall, darkened (the wall goes on down).
  rows 15–22  the flesh wall again.
Everything is cut and repeated; no pixel is redrawn. Used by build_assets.py ("tissue").
"""
import png

TILE = 16
COLUMNS = 20
WIDTH = COLUMNS * TILE
CLEAR = (0, 0, 0, 0)
STRIP_X, PERIOD = 64, 64  # a stretch of the ledge with no pod on it
CREST_Y = 108  # a few px above the crest's top, so its bumps show


def crop(img: png.Image, x: int, y: int, w: int, h: int) -> png.Image:
    return [list(r[x : x + w]) for r in img[y : y + h]]


def shade(p: tuple, k: float) -> tuple:
    return (int(p[0] * k), int(p[1] * k), int(p[2] * k), p[3]) if p[3] else p


def repeat(piece: png.Image, width: int, height: int) -> png.Image:
    w, h = len(piece[0]), len(piece)
    return [[piece[y % h][x % w] for x in range(width)] for y in range(height)]


def build(tiles_path: str, background_path: str) -> png.Image:
    tiles = png.read(tiles_path)
    wall = repeat(png.read(background_path), WIDTH, TILE * 8)
    floor = repeat(crop(tiles, STRIP_X, CREST_Y, PERIOD, TILE), WIDTH, TILE)
    under = repeat(crop(tiles, STRIP_X, CREST_Y + TILE, PERIOD, TILE * 2), WIDTH, TILE * 2)

    deck = [[CLEAR] * WIDTH for _ in range(TILE * 3)]

    def put(col: int, row: int, tile: png.Image) -> None:
        for y in range(TILE):
            for x in range(TILE):
                deck[row * TILE + y][col * TILE + x] = tile[y][x]

    left_end = crop(tiles, 32, CREST_Y, TILE, TILE)
    put(3, 0, [[CLEAR] * 11 + row[:5] for row in left_end])
    put(10, 0, crop(tiles, STRIP_X, CREST_Y, TILE, TILE))
    put(17, 0, crop(tiles, 208, CREST_Y, TILE, TILE))
    # Legs: a flesh pillar made of the ledge's two rounded ends (their outlined sides).
    left_side = crop(tiles, 32, CREST_Y + TILE, TILE, TILE * 2)
    right_side = crop(tiles, 208, CREST_Y + TILE, TILE, TILE * 2)
    for col, side in ((15, left_side), (16, right_side)):
        put(col, 0, crop(tiles, STRIP_X + (col - 15) * TILE, CREST_Y, TILE, TILE))
        put(col, 1, crop(side, 0, 0, TILE, TILE))
        put(col, 2, crop(side, 0, TILE, TILE, TILE))
    # Pits: the hive wall going on down into the dark.
    back = png.read(background_path)
    band = [[shade(p, 0.55) for p in row] for row in crop(back, 0, len(back) - TILE, len(back[0]), TILE)]
    pits = [[band[y][x % len(band[0])] if x < TILE * 3 else CLEAR for x in range(WIDTH)] for y in range(TILE)]
    return wall + floor + under + deck + pits + wall
