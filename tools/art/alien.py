"""Builds the alien base tileset for Level 3's first sections (owner chose "into the hive",
2026-10-20: 3-1 and 3-2 in the alien base, then inside the hive).

Source: the Warped "alien-environment" tiles (224×192): mossy bridges on dark trusses. Same rows
as the steelworks tileset (tools/art/steelworks.py), so tools/levels/steelworks_section.py lays
it out the same way. 320×368, 16 px tiles, 20 columns:
  rows 0–7    the base's back wall: its background and back structures flattened, top 128 px.
  row 8       the floor: the long bridge's plank deck (source y 105–120), its middle 80 px
              repeated, so ribs and planks line up every 5 tiles.
  rows 9–10   under the floor: the bridge's underside and arch (source y 121–152), the same
              80 px repeated. Clear between the arches, so the backdrop shows through as in the
              pack's preview.
  rows 11–13  a one-way walkway: the small vent platform as the deck (its left end starts 11 px
              into its tile, as the generator expects), its truss as the legs.
  row 14      pit tiles: clear, so a gap between bridges shows the backdrop.
  rows 15–22  the back wall again (indoor sections use these rows).
Everything is cut and repeated; no pixel is redrawn. Used by build_assets.py ("alien").
"""
import png

TILE = 16
COLUMNS = 20
WIDTH = COLUMNS * TILE
CLEAR = (0, 0, 0, 0)
BRIDGE_X, BRIDGE_PERIOD = 120, 80  # the long bridge's middle, between its end caps
DECK_TOP = 105  # its plank deck's top row


def crop(img: png.Image, x: int, y: int, w: int, h: int) -> png.Image:
    return [list(r[x : x + w]) for r in img[y : y + h]]


def over(base: png.Image, top: png.Image) -> png.Image:
    return [[t if t[3] else b for b, t in zip(br, tr)] for br, tr in zip(base, top)]


def repeat_x(piece: png.Image, width: int) -> png.Image:
    w = len(piece[0])
    return [[row[x % w] for x in range(width)] for row in piece]


def wall(background: png.Image, structures: png.Image) -> png.Image:
    back = repeat_x(background, WIDTH)
    return over(back, repeat_x(structures, WIDTH))[:128]


def build(tiles_path: str, background_path: str, structures_path: str) -> png.Image:
    tiles = png.read(tiles_path)
    bridge = crop(tiles, BRIDGE_X, DECK_TOP, BRIDGE_PERIOD, 48)
    floor = repeat_x(bridge[:TILE], WIDTH)
    under = repeat_x(bridge[TILE:], WIDTH)
    back = wall(png.read(background_path), png.read(structures_path))

    # Walkway rows: deck tiles in the columns the generator uses (3 left end, 10 middle,
    # 17 right end, 15–16 above the legs), legs (the truss) under columns 15–16.
    deck = [[CLEAR] * WIDTH for _ in range(TILE * 3)]

    def put(col: int, row: int, tile: png.Image) -> None:
        for y in range(TILE):
            for x in range(TILE):
                deck[row * TILE + y][col * TILE + x] = tile[y][x]

    platform = crop(tiles, 32, 26, 64, TILE)  # the vent platform's top, 64 px wide
    left = [[CLEAR] * 11 + row[:5] for row in platform]
    put(3, 0, left)
    put(10, 0, crop(platform, 16, 0, TILE, TILE))
    put(17, 0, crop(platform, 48, 0, TILE, TILE))
    truss = crop(tiles, 64, 48, 32, 32)
    for col in (15, 16):
        put(col, 0, crop(platform, 16 + (col - 15) * TILE, 0, TILE, TILE))
        put(col, 1, crop(truss, (col - 15) * TILE, 0, TILE, TILE))
        put(col, 2, crop(truss, (col - 15) * TILE, TILE, TILE, TILE))
    pits = [[CLEAR] * WIDTH for _ in range(TILE)]
    return back + floor + under + deck + pits + back
