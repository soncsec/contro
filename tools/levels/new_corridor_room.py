#!/usr/bin/env python3
"""Creates a starting Tiled map (.tmj) by chaining room sections of the corridor tileset.

Usage: python3 tools/levels/new_corridor_room.py <out.tmj> <section>... [--enemy X]... [--flyer X:Y]... [--platform X:ROW:W]...
       [--pit X:W]... [--checkpoint X]... [--exit]

This only makes a first version of a map. After that, the .tmj file is the source of
truth: edit it in Tiled (or by hand) and validate it with `npm test` (ARCHITECTURE.md ADR-C01).

Sections are rectangles of the 512x608 corridor tileset, in 16 px tiles. Each is 11 tiles
(176 px, the full screen height) tall and joins seamlessly with the others.
"""
import argparse
import json
import pathlib

TILE = 16
COLUMNS = 32  # tileset width in tiles
ROWS = 38
# name: (first column, first row, width in tiles)
SECTIONS = {
    "panels": (1, 1, 7),  # wall panels with a ceiling light
    "cryo": (9, 1, 14),  # cryo machine and wall panels
    "terminal": (1, 13, 7),  # wall panels with a terminal
    "window": (9, 13, 21),  # wall panels and a window onto the city (see-through)
    "shutter": (1, 26, 8),  # shutter door
    "exit": (10, 26, 21),  # wall panels, EXIT door, wall panels
}
HEIGHT = 11
FLOOR_Y = 160  # where feet touch the floor, in pixels from the top of the map
FLOOR_ROW = 9  # first tile row of the floor plane (y 144–175)

# Catwalk tileset (tools/art/catwalk.py), embedded after the corridor tileset.
CATWALK_COLUMNS, CATWALK_ROWS = 3, 3
CATWALK_DECK = 7  # walkable top row inside a catwalk tile
CATWALK_DECK_HEIGHT = 6  # rows 7–12 are solid deck
CW_LEFT, CW_MID, CW_RIGHT = 0, 1, 2  # row 0
PIT_LEFT, PIT_MID, PIT_RIGHT = 3, 4, 5  # rows 1–2 (top halves; +3 for bottom halves)
PIT_LIP = 12  # pit edge tiles: solid floor up to and including x 11, the drop from x 12


def build(sections: list[str], enemies: list[int], with_exit: bool, checkpoints: list[int] | None = None,
          flyers: list[str] | None = None, platforms: list[str] | None = None,
          pits: list[str] | None = None) -> dict:
    columns = [(SECTIONS[s][0] + dx, SECTIONS[s][1]) for s in sections for dx in range(SECTIONS[s][2])]
    width = len(columns)
    data = []
    for dy in range(HEIGHT):
        for col, row in columns:
            data.append((row + dy) * COLUMNS + col + 1)  # +1: first gid
    width_px = width * TILE
    objects_id = iter(range(1, 1000))
    spawns = [{"id": next(objects_id), "name": "", "type": "player-start", "point": True,
               "x": 48, "y": FLOOR_Y, "width": 0, "height": 0, "rotation": 0, "visible": True}]
    for x in enemies:
        spawns.append({"id": next(objects_id), "name": "", "type": "enemy", "point": True,
                       "x": x, "y": FLOOR_Y, "width": 0, "height": 0, "rotation": 0, "visible": True,
                       "properties": [{"name": "enemy", "type": "string", "value": "alien-walker"}]})
    for xy in flyers or []:
        fx, fy = (int(v) for v in xy.split(":"))
        spawns.append({"id": next(objects_id), "name": "", "type": "enemy", "point": True,
                       "x": fx, "y": fy, "width": 0, "height": 0, "rotation": 0, "visible": True,
                       "properties": [{"name": "enemy", "type": "string", "value": "alien-flyer"}]})
    for x in checkpoints or []:
        spawns.append({"id": next(objects_id), "name": "", "type": "checkpoint", "point": True,
                       "x": x, "y": FLOOR_Y, "width": 0, "height": 0, "rotation": 0, "visible": True})
    if with_exit:
        # The EXIT door sits 9-12 tiles into the "exit" section.
        start = sum(SECTIONS[s][2] for s in sections[: sections.index("exit")]) if "exit" in sections else width - 4
        spawns.append({"id": next(objects_id), "name": "", "type": "exit", "x": (start + 9) * TILE,
                       "y": FLOOR_Y - 64, "width": 4 * TILE, "height": 64, "rotation": 0, "visible": True})
    # Catwalks and pits are drawn on a "platforms" layer with the catwalk tileset (firstgid follows).
    cw_first = COLUMNS * ROWS + 1
    overlay = [0] * (width * HEIGHT)
    colliders = []

    def put(col: int, row: int, tile: int) -> None:
        overlay[row * width + col] = cw_first + tile

    for spec in platforms or []:
        px, prow, pw = (int(v) for v in spec.split(":"))
        if px % TILE or pw % TILE or pw < 2 * TILE:
            raise SystemExit(f"--platform {spec}: x and width must be multiples of 16, width at least 32")
        c0, n = px // TILE, pw // TILE
        for i in range(n):
            put(c0 + i, prow, CW_LEFT if i == 0 else CW_RIGHT if i == n - 1 else CW_MID)
        colliders.append({"type": "platform", "x": px, "y": prow * TILE + CATWALK_DECK,
                          "width": pw, "height": CATWALK_DECK_HEIGHT})

    floor_gaps = []
    for spec in pits or []:
        px, pw = (int(v) for v in spec.split(":"))
        if px % TILE or pw % TILE or pw < 3 * TILE:
            raise SystemExit(f"--pit {spec}: x and width must be multiples of 16, width at least 48")
        c0, n = px // TILE, pw // TILE
        for i in range(n):
            top = PIT_LEFT if i == 0 else PIT_RIGHT if i == n - 1 else PIT_MID
            put(c0 + i, FLOOR_ROW, top)
            put(c0 + i, FLOOR_ROW + 1, top + 3)
        floor_gaps.append((px + PIT_LIP, px + pw - PIT_LIP))

    # The floor is solid except over the pits.
    x = 0
    for gap_start, gap_end in sorted(floor_gaps) + [(width_px, width_px)]:
        if gap_start > x:
            colliders.append({"type": "solid", "x": x, "y": FLOOR_Y, "width": gap_start - x,
                              "height": HEIGHT * TILE - FLOOR_Y})
        x = gap_end
    for c in colliders:
        c.update({"id": next(objects_id), "name": "", "rotation": 0, "visible": True})
    return {
        "type": "map", "version": "1.10", "tiledversion": "1.11.0", "orientation": "orthogonal",
        "renderorder": "right-down", "infinite": False, "compressionlevel": -1,
        "width": width, "height": HEIGHT, "tilewidth": TILE, "tileheight": TILE,
        "nextlayerid": 5, "nextobjectid": next(objects_id),
        "properties": [{"name": "background", "type": "string", "value": "corridor-back"}],
        "layers": [
            {"type": "tilelayer", "id": 1, "name": "background", "x": 0, "y": 0, "width": width,
             "height": HEIGHT, "opacity": 1, "visible": True, "data": data},
            {"type": "tilelayer", "id": 4, "name": "platforms", "x": 0, "y": 0, "width": width,
             "height": HEIGHT, "opacity": 1, "visible": True, "data": overlay},
            {"type": "objectgroup", "id": 2, "name": "collision", "draworder": "topdown", "x": 0, "y": 0,
             "opacity": 1, "visible": True, "objects": colliders},
            {"type": "objectgroup", "id": 3, "name": "spawns", "draworder": "topdown", "x": 0, "y": 0,
             "opacity": 1, "visible": True, "objects": spawns},
        ],
        "tilesets": [{"firstgid": 1, "name": "corridor", "image": "corridor/tileset.png",
                      "imagewidth": COLUMNS * TILE, "imageheight": ROWS * TILE, "tilewidth": TILE,
                      "tileheight": TILE, "tilecount": COLUMNS * ROWS, "columns": COLUMNS,
                      "margin": 0, "spacing": 0},
                     {"firstgid": cw_first, "name": "catwalk", "image": "corridor/catwalk.png",
                      "imagewidth": CATWALK_COLUMNS * TILE, "imageheight": CATWALK_ROWS * TILE,
                      "tilewidth": TILE, "tileheight": TILE,
                      "tilecount": CATWALK_COLUMNS * CATWALK_ROWS, "columns": CATWALK_COLUMNS,
                      "margin": 0, "spacing": 0}],
    }


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("out")
    ap.add_argument("sections", nargs="+", choices=sorted(SECTIONS))
    ap.add_argument("--enemy", type=int, action="append", default=[], help="enemy x position in px")
    ap.add_argument("--flyer", action="append", default=[], help="flying alien at X:Y (its hover point) in px")
    ap.add_argument("--platform", action="append", default=[],
                    help="catwalk at X:ROW:W (x and width in px, multiples of 16; deck top = ROW*16+7)")
    ap.add_argument("--pit", action="append", default=[], help="pit at X:W in px (multiples of 16, W >= 48)")
    ap.add_argument("--checkpoint", type=int, action="append", default=[], help="checkpoint x position in px")
    ap.add_argument("--exit", action="store_true", help="add an exit at the EXIT door")
    args = ap.parse_args()
    out = pathlib.Path(args.out)
    out.write_text(json.dumps(build(args.sections, args.enemy, args.exit, args.checkpoint, args.flyer, args.platform, args.pit), indent=1) + "\n")
    print(f"wrote {out}")
