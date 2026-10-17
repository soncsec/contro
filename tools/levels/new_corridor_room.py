#!/usr/bin/env python3
"""Creates a starting Tiled map (.tmj) by chaining room sections of the corridor tileset.

Usage: python3 tools/levels/new_corridor_room.py <out.tmj> <section>... [--enemy X]... [--exit]

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


def build(sections: list[str], enemies: list[int], with_exit: bool) -> dict:
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
    if with_exit:
        # The EXIT door sits 9-12 tiles into the "exit" section.
        start = sum(SECTIONS[s][2] for s in sections[: sections.index("exit")]) if "exit" in sections else width - 4
        spawns.append({"id": next(objects_id), "name": "", "type": "exit", "x": (start + 9) * TILE,
                       "y": FLOOR_Y - 64, "width": 4 * TILE, "height": 64, "rotation": 0, "visible": True})
    solid = {"id": next(objects_id), "name": "", "type": "solid", "x": 0, "y": FLOOR_Y,
             "width": width_px, "height": HEIGHT * TILE - FLOOR_Y, "rotation": 0, "visible": True}
    return {
        "type": "map", "version": "1.10", "tiledversion": "1.11.0", "orientation": "orthogonal",
        "renderorder": "right-down", "infinite": False, "compressionlevel": -1,
        "width": width, "height": HEIGHT, "tilewidth": TILE, "tileheight": TILE,
        "nextlayerid": 4, "nextobjectid": next(objects_id),
        "properties": [{"name": "background", "type": "string", "value": "corridor-back"}],
        "layers": [
            {"type": "tilelayer", "id": 1, "name": "background", "x": 0, "y": 0, "width": width,
             "height": HEIGHT, "opacity": 1, "visible": True, "data": data},
            {"type": "objectgroup", "id": 2, "name": "collision", "draworder": "topdown", "x": 0, "y": 0,
             "opacity": 1, "visible": True, "objects": [solid]},
            {"type": "objectgroup", "id": 3, "name": "spawns", "draworder": "topdown", "x": 0, "y": 0,
             "opacity": 1, "visible": True, "objects": spawns},
        ],
        "tilesets": [{"firstgid": 1, "name": "corridor", "image": "corridor/tileset.png",
                      "imagewidth": COLUMNS * TILE, "imageheight": ROWS * TILE, "tilewidth": TILE,
                      "tileheight": TILE, "tilecount": COLUMNS * ROWS, "columns": COLUMNS,
                      "margin": 0, "spacing": 0}],
    }


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("out")
    ap.add_argument("sections", nargs="+", choices=sorted(SECTIONS))
    ap.add_argument("--enemy", type=int, action="append", default=[], help="enemy x position in px")
    ap.add_argument("--exit", action="store_true", help="add an exit at the EXIT door")
    args = ap.parse_args()
    out = pathlib.Path(args.out)
    out.write_text(json.dumps(build(args.sections, args.enemy, args.exit), indent=1) + "\n")
    print(f"wrote {out}")
