#!/usr/bin/env python3
"""Builds a Level 1 steelworks section (.tmj) from a short layout description.

Usage: python3 tools/levels/steelworks_section.py <layout name> <out.tmj>

Layouts are in LAYOUTS below. A layout gives the width in tiles and lists, in 16 px tiles:
  floor      [start, end) spans of ground; gaps between them are pits
  blocks     raised ledges (start, end, top row): solid steel from that row down to the floor
  walkways   one-way scaffold decks (start, width, row) with ladder legs down to the ground
  walkers    alien walkers by tile column; they stand on the walkway or ground there
             ("Ng" puts one on the ground under a walkway)
  flyers     (column, y px) alien flyers
  checkpoints, start, exit: columns
  indoor     True for a section inside the steelworks: the piped wall fills the space above the
             ground instead of the open sky and skyline

This makes the first version of a map. After that the .tmj is the source of truth: edit it in
Tiled or by hand, and `npm test` validates it (ARCHITECTURE.md ADR-C01).

Tileset: tools/art/steelworks.py (22 columns). Rows 8–10 are the floor; the plate's top edge is
a tile edge and feet stand FEET_IN px into it. Row 11 is the walkway deck, rows 12–13 its legs.
Rows 15–22 are the wall with pipes, for indoor sections.
"""
import json
import pathlib
import sys

TILE = 16
COLUMNS = 22
HEIGHT = 11  # 176 px
FLOOR_ROW = 8  # top row of the ground
FEET_IN = 8  # feet stand this far below the top edge of a floor plate
DECK_ROW, LEG_TOP_ROW, LEG_ROW = 11, 12, 13
DECK_LEFT, DECK_MID, DECK_RIGHT = 3, 10, 17
LEG_COLS = (15, 16)  # deck tiles above legs, and the legs themselves
PIT_ROW, PIT_SHAFT, PIT_LEFT, PIT_RIGHT = 14, 0, 1, 2
PIPED_WALL_ROW = 15  # rows 15–22: the wall with pipes
TILESET_ROWS = 23
DECK_LEFT_INSET = 11  # the deck starts 11 px into the left end tile
DECK_HEIGHT = 6  # collider thickness of a one-way deck

# Parallax: the industrial skyline, bottoms tucked just under the ground line.
GROUND_Y = FLOOR_ROW * TILE
PARALLAX = [  # (asset key, image file, image height, how far below the ground line it ends, factor)
    ("industrial-sky", "industrial/sky.png", 160, None, 0.0),
    ("industrial-far", "industrial/far.png", 142, 10, 0.15),
    ("industrial-mid", "industrial/mid.png", 150, 6, 0.3),
    ("industrial-near", "industrial/near.png", 104, 2, 0.5),
]

LAYOUTS = {
    # 1-1: the yard outside the steelworks. Steps up and down, an upper walkway route over a
    # lower path, three pits (the middle one needs a running jump), walkers and flyers.
    "yard": {
        "width": 180,
        "floor": [(0, 46), (48, 98), (101, 140), (142, 180)],
        "blocks": [(22, 30, 6), (60, 66, 6), (66, 74, 4), (118, 126, 6), (150, 156, 6), (156, 162, 4)],
        "walkways": [(34, 8, 6), (75, 14, 5), (104, 9, 6), (128, 8, 4)],
        "walkers": [14, 26, "38g", 55, 70, "80g", 86, 110, 122, 132, 152, 168],
        "flyers": [(44, 50), (92, 40), (136, 44), (160, 50)],
        "checkpoints": [50, 102, 144],
        "start": 3,
        "exit": 175,
    },
    # 1-2: inside the steelworks. A staircase up and down, a raised mezzanine with the
    # highest step in the level, two walkway tiers over pits, more walkers on the ground
    # under the walkways, and flyers lower under the roof.
    "interior": {
        "width": 170,
        "indoor": True,
        "floor": [(0, 36), (39, 64), (67, 110), (113, 140), (142, 170)],
        "blocks": [(14, 18, 7), (18, 22, 6), (22, 26, 5), (48, 56, 5), (78, 82, 6), (82, 90, 3),
                   (90, 94, 6), (120, 128, 6), (150, 154, 7), (154, 158, 6)],
        "walkways": [(28, 9, 5), (58, 10, 5), (96, 12, 4), (130, 9, 5)],
        "walkers": [10, 24, 32, "33g", 45, 52, 62, 75, 86, 100, "104g", 116, 125, 134, 147, 162],
        "flyers": [(40, 40), (70, 36), (108, 30), (138, 40), (158, 44)],
        "checkpoints": [46, 95, 144],
        "start": 3,
        "exit": 165,
    },
}


def gid(row: int, col: int) -> int:
    return 1 + row * COLUMNS + col


def build(layout: dict) -> dict:
    width = layout["width"]
    background = [0] * (width * HEIGHT)
    platforms = [0] * (width * HEIGHT)
    top = [None] * width  # top tile row of the ground in each column (None = pit)

    def put(layer: list[int], col: int, row: int, value: int) -> None:
        if 0 <= col < width and 0 <= row < HEIGHT:
            layer[row * width + col] = value

    for x0, x1 in layout["floor"]:
        for x in range(x0, x1):
            top[x] = FLOOR_ROW
    for x0, x1, row in layout["blocks"]:
        for x in range(x0, x1):
            if top[x] is None:
                raise ValueError(f"block over a pit at column {x}")
            top[x] = min(top[x], row)
    for x in range(width):
        if top[x] is None:
            # A dark shaft, with the cut floor's lit face on each side.
            edge = PIT_LEFT if x > 0 and top[x - 1] is not None else None
            if x + 1 < width and top[x + 1] is not None:
                edge = PIT_RIGHT
            for row in range(FLOOR_ROW, HEIGHT):
                put(background, x, row, gid(PIT_ROW, edge if edge is not None else PIT_SHAFT))
            if layout.get("indoor"):
                for row in range(FLOOR_ROW):
                    put(background, x, row, gid(PIPED_WALL_ROW + row, x % COLUMNS))
            continue
        if layout.get("indoor"):
            for row in range(top[x]):
                put(background, x, row, gid(PIPED_WALL_ROW + row, x % COLUMNS))
        put(background, x, top[x], gid(8, x % COLUMNS))  # plate
        for row in range(top[x] + 1, HEIGHT):
            put(background, x, row, gid(9 if row == top[x] + 1 else 10, x % COLUMNS))

    colliders = []
    oid = iter(range(1, 10_000))

    def obj(kind: str, x: float, y: float, w: float = 0, h: float = 0, **props: str) -> dict:
        o = {"id": next(oid), "name": "", "type": kind, "x": x, "y": y, "width": w, "height": h,
             "rotation": 0, "visible": True}
        if w == 0 and h == 0:
            o["point"] = True
        if props:
            o["properties"] = [{"name": k, "type": "string", "value": v} for k, v in props.items()]
        return o

    # Ground colliders: one per run of columns with the same top.
    x = 0
    while x < width:
        if top[x] is None:
            x += 1
            continue
        start = x
        while x < width and top[x] == top[start]:
            x += 1
        y = top[start] * TILE + FEET_IN
        colliders.append(obj("solid", start * TILE, y, (x - start) * TILE, HEIGHT * TILE - y))

    deck_tops = {}  # column -> deck top y, for placing walkers
    for x0, n, row in layout["walkways"]:
        if n < 5:
            raise ValueError("a walkway needs at least 5 tiles")
        tiles = [LEG_COLS[0], LEG_COLS[1]] + [DECK_MID] * (n - 4) + [LEG_COLS[0], LEG_COLS[1]]
        put(platforms, x0 - 1, row, gid(DECK_ROW, DECK_LEFT))
        for i, col in enumerate(tiles):
            put(platforms, x0 + i, row, gid(DECK_ROW, col))
            deck_tops[x0 + i] = row * TILE
        put(platforms, x0 + n, row, gid(DECK_ROW, DECK_RIGHT))
        # Legs under both ends, down to the ground (or the bottom of the screen over a pit).
        for i in (0, 1, n - 2, n - 1):
            col = x0 + i
            stop = top[col] if top[col] is not None else HEIGHT
            for r in range(row + 1, stop):
                leg = LEG_COLS[i % 2 if i < 2 else (i - (n - 2))]
                put(platforms, col, r, gid(LEG_TOP_ROW if r == row + 1 else LEG_ROW, leg))
        left = (x0 - 1) * TILE + DECK_LEFT_INSET
        right = (x0 + n + 1) * TILE
        colliders.append(obj("platform", left, row * TILE, right - left, DECK_HEIGHT))

    def surface(col: int, ground: bool = False) -> float:
        if col in deck_tops and not ground:
            return deck_tops[col]
        if top[col] is None:
            raise ValueError(f"nothing to stand on at column {col}")
        return top[col] * TILE + FEET_IN

    spawns = [obj("player-start", layout["start"] * TILE, surface(layout["start"]))]
    for w in layout["walkers"]:
        col, ground = (int(w[:-1]), True) if isinstance(w, str) else (w, False)
        spawns.append(obj("enemy", col * TILE, surface(col, ground), enemy="alien-walker"))
    for col, y in layout["flyers"]:
        spawns.append(obj("enemy", col * TILE, y, enemy="alien-flyer"))
    for col in layout["checkpoints"]:
        spawns.append(obj("checkpoint", col * TILE, surface(col)))
    ex = layout["exit"]
    spawns.append(obj("exit", ex * TILE, surface(ex) - 64, 4 * TILE, 64))

    image_layers = []
    for i, (key, image, h, below, factor) in enumerate([] if layout.get("indoor") else PARALLAX):
        offsety = 0 if below is None else GROUND_Y + below - h
        image_layers.append({"id": 10 + i, "name": key, "type": "imagelayer", "image": image,
                             "offsetx": 0, "offsety": offsety, "parallaxx": factor, "parallaxy": 1,
                             "repeatx": True, "repeaty": False, "opacity": 1, "visible": True,
                             "x": 0, "y": 0})

    def tile_layer(lid: int, name: str, data: list[int]) -> dict:
        return {"id": lid, "name": name, "type": "tilelayer", "width": width, "height": HEIGHT,
                "data": data, "opacity": 1, "visible": True, "x": 0, "y": 0}

    return {
        "type": "map", "version": "1.10", "tiledversion": "1.11.0", "orientation": "orthogonal",
        "renderorder": "right-down", "infinite": False, "compressionlevel": -1,
        "width": width, "height": HEIGHT, "tilewidth": TILE, "tileheight": TILE,
        "nextlayerid": 20, "nextobjectid": next(oid),
        "layers": image_layers + [
            tile_layer(1, "background", background),
            tile_layer(2, "platforms", platforms),
            {"id": 3, "name": "collision", "type": "objectgroup", "draworder": "topdown",
             "objects": colliders, "opacity": 1, "visible": True, "x": 0, "y": 0},
            {"id": 4, "name": "spawns", "type": "objectgroup", "draworder": "topdown",
             "objects": spawns, "opacity": 1, "visible": True, "x": 0, "y": 0},
        ],
        "tilesets": [{"firstgid": 1, "name": "steelworks", "image": "steelworks/tileset.png",
                      "imagewidth": COLUMNS * TILE, "imageheight": TILESET_ROWS * TILE, "tilewidth": TILE,
                      "tileheight": TILE, "tilecount": COLUMNS * TILESET_ROWS, "columns": COLUMNS,
                      "margin": 0, "spacing": 0}],
    }


def main() -> None:
    name, out = sys.argv[1], pathlib.Path(sys.argv[2])
    out.write_text(json.dumps(build(LAYOUTS[name]), indent=1) + "\n")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
