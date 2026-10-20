#!/usr/bin/env python3
"""Builds a Level 2 corridor section (.tmj) from a short layout description (M4.3).

Usage: python3 tools/levels/corridor_section.py <layout name> <out.tmj>

Builds on tools/levels/new_corridor_room.py (the corridor's room modules, catwalks and pits) and
adds what Level 2 needs: walkers on catwalks, bipedal walkers, runner spawners, blimps, and a
"props" layer with the cyberpunk props (tools/art/props.py) standing on the floor. All x values
are tile columns; the floor is where feet touch, y 160.
  rooms      room modules, left to right (new_corridor_room.SECTIONS; end with "exit")
  pits       columns where a 3-tile pit starts
  catwalks   (column, row, width in tiles): one-way catwalks; deck top at row*16 + 7
  walkers    columns of alien walkers on the floor; (column, "cw") stands one on the catwalk there
  flyers     (column, y px)
  bipeds     columns of bipedal walkers (on the floor)
  spawners   (column, count, every ms, "left"|"right")
  blimps     (column, y px, carries, "left"|"right")
  props      (name, column): a prop standing on the floor (props.PROPS)
  checkpoints columns
This makes the first version of a map; after that the .tmj is the source of truth (ADR-C01).
"""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "art"))
import new_corridor_room as room  # noqa: E402
import props as prop_art  # noqa: E402

TILE = 16
FLOOR_Y = room.FLOOR_Y
FLOOR_ROW = room.FLOOR_ROW  # 9: props stand with their bottom tile in row 8 (feet at y 160)

LAYOUTS = {
    # 2-2: inside the Neon District's corridors. Pits under catwalks, catwalks at two heights,
    # cryo pods and server racks along the walls, a bipedal walker in the middle.
    "corridor": {
        "rooms": ["panels", "cryo", "terminal", "window", "panels", "shutter", "cryo", "terminal",
                  "window", "panels", "cryo", "panels", "exit"],
        "pits": [34, 76, 118],
        "catwalks": [(30, 6, 11), (46, 4, 6), (72, 6, 11), (90, 5, 7), (114, 6, 11), (130, 4, 6)],
        "walkers": [14, 24, (35, "cw"), 52, 60, (77, "cw"), 86, 100, 108, (119, "cw"), 140, 150],
        "flyers": [(44, 50), (96, 44), (136, 48)],
        "bipeds": [104],
        "spawners": [(40, 3, 1100, "right"), (88, 3, 1000, "left"), (126, 3, 1000, "right")],
        "blimps": [(20, 44, "machine-gun", "right"), (110, 48, "health", "right")],
        "props": [("cryo", 9), ("servers", 54), ("terminal", 62), ("cryo", 96), ("servers", 142),
                  ("terminal", 152)],
        "checkpoints": [40, 82, 124],
    },
}


def obj(oid, kind, x, y, **props):
    o = {"id": oid, "name": "", "type": kind, "point": True, "x": x, "y": y, "width": 0, "height": 0,
         "rotation": 0, "visible": True}
    if props:
        o["properties"] = [{"name": k, "type": "int" if isinstance(v, int) else "string", "value": v}
                           for k, v in props.items()]
    return o


def build(layout: dict) -> dict:
    floor_walkers = [w for w in layout["walkers"] if isinstance(w, int)]
    cw = {c: r for c, r, _ in layout["catwalks"]}
    m = room.build(
        layout["rooms"], [c * TILE for c in floor_walkers], True,
        [c * TILE for c in layout["checkpoints"]],
        [f"{c * TILE}:{y}" for c, y in layout["flyers"]],
        [f"{c * TILE}:{r}:{w * TILE}" for c, r, w in layout["catwalks"]],
        [f"{c * TILE}:{3 * TILE}" for c in layout["pits"]],
    )
    width = m["width"]
    layers = {l["name"]: l for l in m["layers"]}
    spawns = layers["spawns"]["objects"]
    oid = iter(range(m["nextobjectid"], 10_000))

    def catwalk_top(col: int) -> int:
        for c, r, w in layout["catwalks"]:
            if c <= col < c + w:
                return r * TILE + room.CATWALK_DECK
        raise ValueError(f"no catwalk at column {col}")

    for col, where in [w for w in layout["walkers"] if not isinstance(w, int)]:
        spawns.append(obj(next(oid), "enemy", col * TILE, catwalk_top(col), enemy="alien-walker"))
    for col in layout.get("bipeds", []):
        spawns.append(obj(next(oid), "enemy", col * TILE, FLOOR_Y, enemy="bipedal-walker"))
    for col, count, every, side in layout.get("spawners", []):
        spawns.append(obj(next(oid), "spawner", col * TILE, FLOOR_Y, enemy="alien-runner",
                          count=count, every=every, **{"from": side}))
    for col, y, carries, side in layout.get("blimps", []):
        spawns.append(obj(next(oid), "blimp", col * TILE, y, carries=carries, **{"from": side}))
    m["nextobjectid"] = next(oid)

    # The props layer: each prop's cell, bottom row on the last row above the floor plane.
    first = max(t["firstgid"] + t["tilecount"] for t in m["tilesets"])
    data = [0] * (width * room.HEIGHT)
    pits = {c + i for c in layout["pits"] for i in range(3)}
    for name, col in layout.get("props", []):
        _, pcol, pw, ph = prop_art.PROPS[name]
        if any(c in pits for c in range(col, col + pw)):
            raise ValueError(f"prop {name} at column {col} stands over a pit")
        for dy in range(ph):
            for dx in range(pw):
                src = (prop_art.ROWS - ph + dy) * prop_art.COLUMNS + pcol + dx
                data[(FLOOR_ROW - ph + dy) * width + col + dx] = first + src
    m["layers"].insert(1, {"type": "tilelayer", "id": 5, "name": "props", "x": 0, "y": 0,
                           "width": width, "height": room.HEIGHT, "opacity": 1, "visible": True,
                           "data": data})
    m["nextlayerid"] = 6
    m["tilesets"].append({"firstgid": first, "name": "props", "image": "corridor/props.png",
                          "imagewidth": prop_art.COLUMNS * TILE, "imageheight": prop_art.ROWS * TILE,
                          "tilewidth": TILE, "tileheight": TILE,
                          "tilecount": prop_art.COLUMNS * prop_art.ROWS, "columns": prop_art.COLUMNS,
                          "margin": 0, "spacing": 0})
    return m


def main() -> None:
    name, out = sys.argv[1], pathlib.Path(sys.argv[2])
    out.write_text(json.dumps(build(LAYOUTS[name]), indent=1) + "\n")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
