#!/usr/bin/env python3
"""Renders a Tiled map (.tmj) to a PNG for PR screenshots, with collision boxes and spawns marked.

Usage: python3 tools/levels/render_map.py <map.tmj> <out.png> [--scale N]

Draws: the map's background image (repeated), the tile layers, collision rectangles
(solid = red outline, platform = yellow), and spawns (player = green, enemy = orange, exit = cyan).
"""
import argparse
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "art"))
import png  # noqa: E402

COLORS = {"solid": (255, 60, 60, 255), "platform": (255, 220, 0, 255), "player-start": (60, 255, 90, 255),
          "enemy": (255, 150, 0, 255), "exit": (0, 230, 255, 255)}
BACKGROUNDS = {"corridor-back": "corridor/back.png"}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("map")
    ap.add_argument("out")
    ap.add_argument("--scale", type=int, default=2)
    args = ap.parse_args()
    path = pathlib.Path(args.map)
    m = json.loads(path.read_text())
    tw, th, w, h = m["tilewidth"], m["tileheight"], m["width"], m["height"]
    canvas = [[(0, 0, 0, 255)] * (w * tw) for _ in range(h * th)]
    props = {p["name"]: p["value"] for p in m.get("properties", [])}
    if props.get("background") in BACKGROUNDS:
        bg = png.read(str(path.parent / BACKGROUNDS[props["background"]]))
        for y in range(min(len(bg), len(canvas))):
            for x in range(len(canvas[0])):
                canvas[y][x] = bg[y][x % len(bg[0])]
    ts = m["tilesets"][0]
    sheet = png.read(str(path.parent / ts["image"]))
    for layer in m["layers"]:
        if layer["type"] != "tilelayer":
            continue
        for i, gid in enumerate(layer["data"]):
            if gid == 0:
                continue
            t = gid - ts["firstgid"]
            sx, sy = (t % ts["columns"]) * tw, (t // ts["columns"]) * th
            dx, dy = (i % w) * tw, (i // w) * th
            for y in range(th):
                for x in range(tw):
                    c = sheet[sy + y][sx + x]
                    if c[3]:
                        canvas[dy + y][dx + x] = c
    for layer in m["layers"]:
        if layer["type"] != "objectgroup":
            continue
        for o in layer["objects"]:
            c = COLORS.get(o.get("type", ""), (255, 0, 255, 255))
            x0, y0 = int(o["x"]), int(o["y"])
            if o.get("point"):
                for d in range(-3, 4):
                    for px, py in ((x0 + d, y0), (x0, y0 + d)):
                        if 0 <= py < len(canvas) and 0 <= px < len(canvas[0]):
                            canvas[py][px] = c
                continue
            x1, y1 = x0 + int(o["width"]) - 1, y0 + int(o["height"]) - 1
            for x in range(x0, x1 + 1):
                for y in (y0, y1):
                    if 0 <= y < len(canvas) and 0 <= x < len(canvas[0]):
                        canvas[y][x] = c
            for y in range(y0, y1 + 1):
                for x in (x0, x1):
                    if 0 <= y < len(canvas) and 0 <= x < len(canvas[0]):
                        canvas[y][x] = c
    s = args.scale
    png.write(args.out, [[c for c in row for _ in range(s)] for row in canvas for _ in range(s)])
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
