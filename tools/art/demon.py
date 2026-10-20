"""Builds the demon, Level 3's boss (M5.3), and its acid shots.

The owner chose the Gothicvania demon in hive colours from mockups (2026-10-20): its idle
frames, cropped from 256×176 to the 160×128 around the demon, with dark red recoloured to
acid green (wings), cyan to yellow-green (the skull's flames) and purple kept dark. The acid
glob and the acid wave are drawn by Claude in the same greens.
Used by build_assets.py ("demon", "draw:acid-glob", "draw:acid-wave").
"""
import colorsys
import math
import pathlib

import png

CROP = (50, 17, 160, 128)  # x, y, width, height of the demon inside each 256×176 frame
CLEAR = (0, 0, 0, 0)
ACID = (150, 230, 60, 255)
ACID_LIGHT = (220, 255, 140, 255)
ACID_DARK = (60, 120, 30, 255)


def _hive_colours(p: tuple) -> tuple:
    r, g, b, a = p
    if a == 0:
        return p
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    if (h < 0.08 or h > 0.9) and s > 0.25:  # dark red wings -> acid green
        h, v = 0.30, min(1.0, v * 1.1)
    elif 0.45 < h < 0.6 and s > 0.3:  # cyan skull flames -> yellow-green
        h, s, v = 0.22, min(1.0, s * 1.1), min(1.0, v * 1.15)
    elif 0.65 < h < 0.9:  # purple cloak stays dark, a little cooler
        h, s = 0.80, s * 0.9
    R, G, B = colorsys.hsv_to_rgb(h, s, v)
    return (int(R * 255), int(G * 255), int(B * 255), a)


def demon(idle_dir: str) -> png.Image:
    frames = []
    for i in range(1, 7):
        img = png.read(str(pathlib.Path(idle_dir) / f"idle{i}.png"))
        x, y, w, h = CROP
        frames.append([[_hive_colours(p) for p in row[x : x + w]] for row in img[y : y + h]])
    return png.strip(frames)


def acid_glob() -> png.Image:
    """8×8, 2 frames: a round glob of acid, its highlight shifting."""
    frames = []
    for k in (0, 1):
        f = [[CLEAR] * 8 for _ in range(8)]
        for y in range(8):
            for x in range(8):
                d = math.hypot(x - 3.5, y - 3.5)
                if d <= 3.6:
                    f[y][x] = ACID_DARK if d > 2.8 else ACID
        f[2 + k][2 + k] = ACID_LIGHT
        f[2 + k][3 + k] = ACID_LIGHT
        frames.append(f)
    return png.strip(frames)


def acid_wave() -> png.Image:
    """24×16, 2 frames: a wave of acid rolling along the floor, its crest curling."""
    frames = []
    for k in (0, 1):
        f = [[CLEAR] * 24 for _ in range(16)]
        for x in range(24):
            # Taller in the middle, a ragged crest that shifts between the frames.
            top = int(4 + 6 * (1 - math.sin(math.pi * (x + 0.5) / 24)) + ((x + k * 2) % 4 == 0))
            for y in range(top, 16):
                f[y][x] = ACID_LIGHT if y == top else (ACID if y < 12 else ACID_DARK)
        frames.append(f)
    return png.strip(frames)
