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
  bipeds     bipedal walkers (M4.2) by tile column, always on the ground
  snakes     spitting snakes (M5.1) by tile column, like walkers: on the walkway, raised
             ledge or ground there ("Ng" for the ground under a walkway)
  blimps     (column, y px, carries, "left"|"right"): a blimp carrying a pickup ("machine-gun",
             "spread" or "health") that flies in from that edge of the screen once the column
             scrolls into view (M4.1)
  spawners   (column, count, every ms, "left"|"right"): runners sent in from that edge of the
             screen once the column scrolls into view (M3.14); the column must be ground
  checkpoints, start, exit: columns
  boss       optional (type, column): a boss fight in an arena, the map's last screen (20 tiles)
  tileset    "steelworks" (default), "rust" (tools/art/rust.py, the same rows, 18 columns) or
             "neon" (tools/art/neon.py, Level 2, 20 columns) or "alien" (tools/art/alien.py,
             Level 3's alien base, 20 columns)
  scenery    the outdoor skyline: "industrial" (default), "neon" (Synth City) or "alien"
             (the alien base's back wall and structures)
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
TILESETS = {  # name -> (image under assets/levels/, columns, how far feet stand into the floor)
    "steelworks": ("steelworks/tileset.png", 22, 8),
    "rust": ("rust/tileset.png", 18, 8),
    # Level 2 (tools/art/neon.py): the floor strip is flat on top, so feet stand near its edge.
    "neon": ("neon/tileset.png", 20, 2),
    # Level 3's alien base (tools/art/alien.py): the bridge's planks start at the tile's top.
    "alien": ("alien/tileset.png", 20, 2),
}
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
SCENERY = {}  # name -> parallax layers, below
PARALLAX = [  # (asset key, image file, image height, how far below the ground line it ends, factor)
    ("industrial-sky", "industrial/sky.png", 160, None, 0.0),
    ("industrial-far", "industrial/far.png", 142, 10, 0.15),
    ("industrial-mid", "industrial/mid.png", 150, 6, 0.3),
    ("industrial-near", "industrial/near.png", 104, 2, 0.5),
]
SCENERY["industrial"] = PARALLAX
# Level 2's outdoor sections: the Synth City skyline (192 px tall), its bottom under the roofs.
SCENERY["neon"] = [
    ("neon-sky", "neon/sky.png", 192, 48, 0.0),
    ("neon-buildings", "neon/buildings.png", 192, 48, 0.15),
    ("neon-front", "neon/front.png", 192, 48, 0.3),
]
# Level 3's alien base: its back wall and structures (176 px tall), their bottom at the map's.
SCENERY["alien"] = [
    ("alien-back", "alien/back.png", 176, 48, 0.0),
    ("alien-structures", "alien/structures.png", 176, 48, 0.3),
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
        "spawners": [(40, 3, 1200, "right"), (104, 3, 1000, "right"), (150, 2, 1500, "left")],
        "blimps": [(30, 48, "machine-gun", "right"), (120, 52, "health", "right")],
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
        "spawners": [(50, 3, 1100, "right"), (120, 4, 900, "right")],
        "blimps": [(36, 44, "spread", "right"), (128, 44, "health", "right")],
        "bipeds": [96],
        "checkpoints": [46, 95, 144],
        "start": 3,
        "exit": 165,
    },
    # 1-3: the rust factory, deeper in (option C for variety). Shorter and denser: four pits,
    # ledges in pairs, staggered walkways climbing over a pit, walkers above and below.
    "factory": {
        "width": 160,
        "tileset": "rust",
        "indoor": True,
        "floor": [(0, 30), (33, 58), (61, 84), (87, 112), (115, 160)],
        "blocks": [(10, 16, 6), (40, 46, 6), (46, 50, 4), (70, 78, 6), (96, 100, 7),
                   (100, 104, 5), (104, 108, 7), (128, 136, 5), (136, 140, 7)],
        "walkways": [(18, 8, 6), (52, 6, 6), (60, 7, 4), (88, 8, 5), (118, 8, 6), (146, 6, 4)],
        "walkers": [8, 13, 24, "25g", 36, 44, 48, 55, 64, "65g", 74, 82, 92, 102, 120, "122g",
                    132, 150],
        "flyers": [(30, 40), (58, 30), (84, 36), (112, 40), (140, 34)],
        "spawners": [(34, 2, 1200, "left"), (90, 4, 900, "right"), (130, 3, 1000, "right")],
        "blimps": [(44, 48, "machine-gun", "right"), (110, 44, "health", "right")],
        "checkpoints": [34, 80, 116],
        "start": 3,
        "exit": 155,
    },
    # 1-4: back outside, along the gantries between the furnace halls. A run of narrow pits
    # (each a running jump), ledges up to 4 tiles high, walkways over the gaps, the most
    # enemies yet, and flyers over every pit.
    "gantries": {
        "width": 170,
        "floor": [(0, 24), (27, 40), (43, 52), (55, 70), (73, 96), (99, 120), (123, 140),
                  (143, 170)],
        "blocks": [(8, 12, 6), (32, 36, 6), (60, 64, 5), (64, 68, 7), (80, 88, 4),
                   (104, 110, 6), (130, 136, 5), (150, 154, 6), (154, 158, 4)],
        "walkways": [(14, 8, 5), (44, 7, 4), (90, 9, 5), (112, 8, 4), (138, 6, 5)],
        "walkers": [10, 20, "21g", 34, 47, 58, 62, 66, 78, 84, 93, 106, 116, "117g", 128, 133,
                    140, 148, 156, 164],
        "flyers": [(26, 44), (50, 36), (72, 40), (100, 34), (122, 44), (146, 38)],
        "spawners": [(44, 3, 1000, "right"), (110, 3, 1000, "right"), (150, 3, 1200, "left")],
        "blimps": [(36, 48, "machine-gun", "right"), (120, 52, "health", "right")],
        "bipeds": [89],
        "checkpoints": [56, 100, 145],
        "start": 3,
        "exit": 165,
    },
    # 1-5: the furnace hall, the last section, in rust. An upper route of ledges and walkways
    # that link up over a lower path with pits, then a long flat floor at the end: the arena
    # where the Level 1 boss, the tank, waits (M3.2–M3.3), after a last rush of walkers.
    "furnace": {
        "width": 180,
        "tileset": "rust",
        "indoor": True,
        "floor": [(0, 30), (33, 50), (53, 76), (79, 96), (99, 118), (121, 140), (142, 180)],
        "blocks": [(12, 16, 6), (16, 20, 4), (20, 24, 6), (40, 46, 5), (62, 66, 6), (66, 70, 4),
                   (86, 92, 6), (104, 108, 5), (108, 112, 3), (112, 116, 6), (128, 134, 5)],
        "walkways": [(26, 10, 5), (54, 7, 5), (72, 12, 4), (94, 8, 5), (118, 9, 4)],
        "walkers": [8, 14, 18, 28, "29g", 38, 44, 56, "57g", 64, 68, 74, 82, "83g", 90, 97, 106,
                    110, 120, "124g", 131, 137, 146, 152],
        "flyers": [(30, 40), (60, 36), (86, 30), (100, 40), (124, 34), (150, 40)],
        "spawners": [(40, 4, 900, "right"), (100, 4, 900, "right"), (130, 3, 1000, "left")],
        "blimps": [(60, 44, "spread", "right"), (136, 48, "health", "right")],
        # The last screen is the tank's arena (M3.3); the exit opens once it is destroyed.
        "boss": ("tank", 176),
        "checkpoints": [53, 102, 142],
        "start": 3,
        "exit": 175,
    },
    # 2-1: the Neon District's rooftops, under the Synth City skyline. Four roofs with gaps to
    # jump, raised blocks to climb, walkways over the gaps, and the first bipedal walker.
    "rooftops": {
        "width": 180,
        "tileset": "neon",
        "scenery": "neon",
        "floor": [(0, 42), (45, 92), (95, 134), (136, 180)],
        "blocks": [(20, 28, 6), (56, 64, 6), (64, 70, 4), (108, 116, 6), (150, 158, 6), (158, 164, 4)],
        "walkways": [(36, 10, 5), (78, 12, 5), (124, 9, 6)],
        "walkers": [14, 30, "40g", 52, 74, "84g", 100, 118, 128, 146, 168],
        "flyers": [(48, 44), (96, 40), (140, 46)],
        "bipeds": [108],
        "spawners": [(36, 3, 1100, "right"), (100, 3, 1000, "right"), (152, 2, 1400, "left")],
        "blimps": [(24, 48, "spread", "right"), (116, 52, "health", "right")],
        "checkpoints": [47, 97, 138],
        "start": 3,
        "exit": 175,
    },
    # 2-3: back out on the rooftops, now on two levels: a high route of raised roofs and
    # walkways over a low route with gaps, rejoining before the exit.
    "skyline": {
        "width": 170,
        "tileset": "neon",
        "scenery": "neon",
        "floor": [(0, 30), (33, 60), (63, 96), (99, 130), (133, 170)],
        "blocks": [(10, 18, 6), (18, 30, 4), (40, 48, 6), (48, 58, 4), (70, 78, 6), (78, 94, 4),
                   (106, 114, 6), (114, 128, 4), (142, 150, 6)],
        "walkways": [(30, 10, 3), (58, 12, 3), (94, 12, 3), (128, 10, 3)],
        "walkers": [8, 22, "24g", 36, 52, "54g", 66, 84, "86g", 102, 120, "122g", 138, 156],
        "flyers": [(40, 36), (88, 32), (124, 36), (160, 44)],
        "bipeds": [66, 138],
        "spawners": [(34, 3, 1000, "right"), (100, 3, 1000, "left"), (140, 3, 1100, "right")],
        "blimps": [(46, 40, "machine-gun", "right"), (118, 40, "health", "right")],
        "checkpoints": [36, 102, 136],
        "start": 3,
        "exit": 165,
    },
    # 2-4: the lab, indoors among the cryo tanks. Long floors broken by pits with walkways
    # over them, stepped platforms, and the densest crowd of the level before the corridor
    # that leads to the boss.
    "lab": {
        "width": 170,
        "tileset": "neon",
        "indoor": True,
        "floor": [(0, 40), (43, 80), (83, 118), (121, 170)],
        "blocks": [(24, 32, 6), (60, 66, 6), (66, 72, 5), (100, 108, 6), (140, 146, 6), (146, 152, 4)],
        "walkways": [(36, 10, 5), (76, 10, 5), (114, 10, 5), (156, 8, 5)],
        "walkers": [12, 20, 38, "45g", 50, 58, 78, "85g", 90, 112, "116g", 126, 134, 160],
        "flyers": [(30, 40), (70, 36), (110, 40), (150, 36)],
        "bipeds": [52, 128],
        "spawners": [(30, 3, 900, "right"), (88, 3, 900, "left"), (130, 4, 900, "right")],
        "blimps": [(22, 40, "spread", "right"), (104, 40, "health", "right")],
        "checkpoints": [45, 85, 123],
        "start": 3,
        "exit": 165,
    },
    # 3-1: the alien base, the way into the hive. Bridges with gaps between them, raised
    # bridges to climb, vent walkways over the gaps, and a bigger crowd than Level 2, with
    # spitting snakes on the high ground.
    "base": {
        "width": 180,
        "tileset": "alien",
        "scenery": "alien",
        "floor": [(0, 36), (39, 70), (73, 100), (103, 128), (131, 152), (155, 180)],
        "blocks": [(16, 24, 6), (50, 58, 6), (58, 64, 4), (84, 92, 6), (112, 120, 6),
                   (120, 126, 4), (162, 170, 6)],
        "walkways": [(32, 10, 5), (66, 10, 5), (96, 10, 5), (127, 9, 5)],
        "walkers": [10, 20, 30, "34g", 46, 56, 64, "68g", 80, 90, 98, "105g", 110, 118, 130, 140,
                    150, 160, 172],
        "flyers": [(40, 40), (76, 36), (112, 40), (146, 36), (168, 40)],
        "bipeds": [116],
        # Spitting snakes (M5.1) on the raised bridges, spitting down at him.
        "snakes": [22, 53, 61, 88, 123, 166],
        "spawners": [(30, 3, 900, "right"), (80, 4, 900, "right"), (140, 4, 900, "left")],
        "blimps": [(20, 44, "spread", "right"), (120, 44, "health", "right")],
        "checkpoints": [45, 106, 140],
        "start": 3,
        "exit": 175,
    },
}


def build(layout: dict) -> dict:
    width = layout["width"]
    tileset_name = layout.get("tileset", "steelworks")
    tileset_image, COLUMNS, FEET_IN = TILESETS[tileset_name]  # noqa: N806

    def gid(row: int, col: int) -> int:
        return 1 + row * COLUMNS + col

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

    def obj(kind: str, x: float, y: float, w: float = 0, h: float = 0, **props) -> dict:
        o = {"id": next(oid), "name": "", "type": kind, "x": x, "y": y, "width": w, "height": h,
             "rotation": 0, "visible": True}
        if w == 0 and h == 0:
            o["point"] = True
        if props:
            o["properties"] = [{"name": k, "type": "int" if isinstance(v, int) else "string", "value": v}
                               for k, v in props.items()]
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
    for w in layout.get("snakes", []):
        col, ground = (int(w[:-1]), True) if isinstance(w, str) else (w, False)
        spawns.append(obj("enemy", col * TILE, surface(col, ground), enemy="spitting-snake"))
    for col in layout.get("bipeds", []):
        spawns.append(obj("enemy", col * TILE, surface(col, True), enemy="bipedal-walker"))
    for col, y in layout["flyers"]:
        spawns.append(obj("enemy", col * TILE, y, enemy="alien-flyer"))
    for col, y, carries, side in layout.get("blimps", []):
        spawns.append(obj("blimp", col * TILE, y, carries=carries, **{"from": side}))
    for col, count, every, side in layout.get("spawners", []):
        spawns.append(obj("spawner", col * TILE, surface(col, True), enemy="alien-runner",
                          count=count, every=every, **{"from": side}))
    for col in layout["checkpoints"]:
        spawns.append(obj("checkpoint", col * TILE, surface(col)))
    ex = layout["exit"]
    spawns.append(obj("exit", ex * TILE, surface(ex) - 64, 4 * TILE, 64))
    if "boss" in layout:
        boss_type, col = layout["boss"]
        spawns.append(obj("boss", col * TILE, surface(col), boss=boss_type))
        screen = 20  # tiles: the arena is the last screen of the map
        spawns.append(obj("arena", (width - screen) * TILE, 0, screen * TILE, HEIGHT * TILE))

    image_layers = []
    scenery = [] if layout.get("indoor") else SCENERY[layout.get("scenery", "industrial")]
    for i, (key, image, h, below, factor) in enumerate(scenery):
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
        "tilesets": [{"firstgid": 1, "name": tileset_name, "image": tileset_image,
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
