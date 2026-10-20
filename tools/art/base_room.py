"""Builds the into-the-screen base room (ADR-C11, M5.6; owner approved the mockup 2026-10-20).

Sources: the Warped "alien-environment" background and back structures. The room is the same
art drawn in perspective (derived): side walls and far wall sample the base's back wall, the
floor and ceiling are shaded in its colours. The core, the electric barrier and the marine
seen from behind are drawn by Claude (there is no back view of the marine in the pack).

The projection matches BASE.projection in src/config/tuning.ts: centre x 160, floor y 176 at
the near edge and 104 at the far wall, far wall at 0.3 of near size, room 240 px tall.
Outputs (all used by build_assets.py):
  room(...)          320×176 room without the core and barrier
  core()             2 frames 28×28: the far wall's glowing core, pulsing
  barrier()          2 frames 96×72: the electric barrier in front of the far wall
  marine_back()      4 frames 22×38: standing, two running steps, crouching
"""
import math

import png

W, H = 320, 176
CX, NEAR_Y, FAR_Y, FAR_SCALE, ROOM_H = 160, 176, 104, 0.3, 240
CLEAR = (0, 0, 0, 0)


def scale(z: float) -> float:
    return 1 / (1 + z * (1 / FAR_SCALE - 1))


VANISH_Y = (FAR_Y - NEAR_Y * FAR_SCALE) / (1 - FAR_SCALE)


def floor_y(z: float) -> float:
    return VANISH_Y + (NEAR_Y - VANISH_Y) * scale(z)


# The far wall's rectangle on screen.
FX0, FX1 = CX - CX * FAR_SCALE, CX + CX * FAR_SCALE
FY0, FY1 = FAR_Y - ROOM_H * FAR_SCALE, FAR_Y


def shade(c: tuple, k: float) -> tuple:
    return tuple(max(0, min(255, int(v * k))) for v in c[:3]) + (255,)


def over(base: png.Image, top: png.Image) -> png.Image:
    return [[t if t[3] else b for b, t in zip(br, tr)] for br, tr in zip(base, top)]


def room(background_path: str, structures_path: str) -> png.Image:
    back = png.read(background_path)
    structures = png.read(structures_path)
    bw, bh = len(back[0]), len(back)
    tex = over([[back[y][x % bw] for x in range(len(structures[0]))] for y in range(bh)], structures)
    tw, th = len(tex[0]), len(tex)
    img = [[(6, 14, 22, 255)] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            if FX0 <= x < FX1 and FY0 <= y < FY1:
                # The far wall: the back structures, a little darker.
                p = tex[int((y - FY0) / (FY1 - FY0) * (th - 1))][int((x - FX0) / (FX1 - FX0) * 200) % tw]
                img[y][x] = shade(p, 0.7)
                continue
            # Which wall is this pixel on? Find the depth where the room's outline passes it.
            side = x < FX0 or x >= FX1
            if side:
                # On a side wall, screen x fixes the depth: x = CX ± CX × scale.
                s = (CX - x) / CX if x < FX0 else (x - CX) / CX
                z = (1 / s - 1) / (1 / FAR_SCALE - 1)
                top = floor_y(z) - ROOM_H * s
                bot = floor_y(z)
                if top <= y < bot:
                    v = (y - top) / (bot - top)
                    col = int(z * 260) % tw
                    if x >= FX1:
                        col = tw - 1 - col
                    img[y][x] = shade(tex[int(v * (th - 1))][col], 0.45 + 0.55 * s)
                    continue
            if y >= FY1:
                # Floor: plank bands that shrink into the distance, lit nearer the front.
                s = (y - VANISH_Y) / (NEAR_Y - VANISH_Y)
                z = (1 / s - 1) / (1 / FAR_SCALE - 1)
                band = int(z * 14) % 2
                c = (44, 56, 50) if band else (32, 42, 38)
                img[y][x] = shade(c, 0.6 + 0.5 * s)
            elif y < FY0:
                img[y][x] = shade((14, 30, 40), 0.5 + 0.5 * (y / FY0))
    # Floor seams running into the room.
    for k in range(-4, 5):
        for y in range(int(FY1), H):
            s = (y - VANISH_Y) / (NEAR_Y - VANISH_Y)
            x = int(CX + k * 40 * s)
            if 0 <= x < W:
                img[y][x] = (66, 86, 72, 255)
    return img


def core() -> png.Image:
    frames = []
    for glow in (1.0, 0.75):
        f = [[CLEAR] * 28 for _ in range(28)]
        for y in range(28):
            for x in range(28):
                d = math.hypot(x - 13.5, y - 13.5)
                if d <= 10.5:
                    g = max(0.0, 1 - d / 10.5) * glow
                    f[y][x] = (int(40 + 130 * g), int(140 + 110 * g), int(40 + 70 * g), 255)
                elif d <= 13:
                    f[y][x] = (64, 72, 70, 255) if (x + y) % 4 else (40, 46, 44, 255)
        frames.append(f)
    return png.strip(frames)


def barrier() -> png.Image:
    frames = []
    for phase in (0, 1):
        f = [[CLEAR] * 96 for _ in range(72)]
        for y in range(72):
            for x in range(96):
                wave = abs(math.sin(y * 0.45 + x * 0.06 + phase * 1.7)) < 0.07
                dots = (y * 7 + x * 3 + phase * 5) % 23 == 0
                if wave or dots:
                    f[y][x] = (120, 230, 255, 200)
        frames.append(f)
    return png.strip(frames)


SUIT, SUIT_DARK = (226, 112, 40, 255), (160, 70, 30, 255)
HELMET, HELMET_SHADE = (232, 230, 222, 255), (168, 166, 160, 255)
PACK, PACK_LIGHT, PACK_DARK = (120, 124, 134, 255), (160, 164, 172, 255), (84, 86, 96, 255)
BOOT, GUN, OUTLINE = (58, 40, 40, 255), (66, 66, 58, 255), (20, 14, 20, 255)


def _marine(legs: str, crouch: bool) -> png.Image:
    w, h = 22, 38
    m = [[CLEAR] * w for _ in range(h)]

    def r(x0: int, y0: int, x1: int, y1: int, c: tuple) -> None:
        for yy in range(max(0, y0), min(h, y1 + 1)):
            for xx in range(max(0, x0), min(w, x1 + 1)):
                m[yy][xx] = c

    top = 10 if crouch else 0  # crouched, he sits 10 px lower
    for yy in range(11):
        for xx in range(4, 18):
            if math.hypot(xx - 10.5, yy - 5.5) <= 5.6:
                m[top + yy][xx] = HELMET if xx < 13 or yy < 4 else HELMET_SHADE
    r(3, top + 10, 18, top + 23 - (4 if crouch else 0), SUIT)
    r(3, top + 10, 4, top + 23 - (4 if crouch else 0), SUIT_DARK)
    r(6, top + 11, 15, top + 20 - (3 if crouch else 0), PACK)
    r(6, top + 11, 15, top + 12, PACK_LIGHT)
    r(14, top + 13, 15, top + 20 - (3 if crouch else 0), PACK_DARK)
    r(1, top + 11, 2, top + 19, SUIT)
    r(19, top + 11, 20, top + 18, SUIT_DARK)
    r(17, top + 2, 18, top + 12, GUN)
    r(16, top + 3, 19, top + 4, GUN)
    if crouch:
        r(3, 24, 9, 33, SUIT)
        r(12, 24, 18, 33, SUIT_DARK)
        r(2, 34, 9, 37, BOOT)
        r(12, 34, 19, 37, BOOT)
    else:
        lift_l, lift_r = {"stand": (0, 0), "left": (3, 0), "right": (0, 3)}[legs]
        r(4, 24, 9, 33 - lift_l, SUIT)
        r(12, 24, 17, 33 - lift_r, SUIT_DARK)
        r(4, 34 - lift_l, 9, 37 - lift_l, BOOT)
        r(12, 34 - lift_r, 17, 37 - lift_r, BOOT)
    out = [row[:] for row in m]
    for yy in range(h):
        for xx in range(w):
            if m[yy][xx][3]:
                continue
            for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
                y2, x2 = yy + dy, xx + dx
                if 0 <= y2 < h and 0 <= x2 < w and m[y2][x2][3]:
                    out[yy][xx] = OUTLINE
                    break
    return out


def marine_back() -> png.Image:
    return png.strip([_marine("stand", False), _marine("left", False), _marine("right", False), _marine("stand", True)])
