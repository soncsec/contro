"""Draws the weapon blimp (M4.1): the airship the marine shoots to drop a weapon pickup.

Drawn by Claude for Contro (owner asked for a dark blimp with reinforcement ribs following the
hull's curve, 2026-10-19), in a gunmetal and bronze palette that sits with the Warped art.
Two frames (the propellers turn). Used by build_assets.py ("draw:blimp").
"""
import math

import png

CLEAR = (0, 0, 0, 0)
W, H = 84, 40


def hx(s: str) -> png.Pixel:
    return (int(s[1:3], 16), int(s[3:5], 16), int(s[5:7], 16), 255)


OUTL = hx("#07080b")
HULL = [hx(c) for c in ("#6a7387", "#525a6c", "#404757", "#323743", "#252932", "#1a1d24", "#121419")]
SEAM = hx("#20232b")
RIB, RIBL, RIBD, RIVET = hx("#6b4625"), hx("#9a6a38"), hx("#3f2814"), hx("#d8ab66")
GON, GONL, GOND = hx("#221a27"), hx("#3d2f45"), hx("#140f17")
WIN, WINH = hx("#00df8d"), hx("#a8ffd2")
YEL, BLK, MET, METD = hx("#d9a420"), hx("#111114"), hx("#8a93a6"), hx("#4b5263")
CX, CY, RX, RY = 46, 15.5, 32, 12.5
DIGITS = {"0": ["XXX", "X.X", "X.X", "X.X", "XXX"], "7": ["XXX", "..X", ".X.", ".X.", ".X."]}


def noise(x: int, y: int) -> float:
    """Deterministic 0–1 texture noise, so the art is the same every build."""
    n = (x * 374761393 + y * 668265263) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return (n & 0xFFFF) / 0xFFFF


def inhull(x: float, y: float) -> bool:
    return ((x - CX) / RX) ** 2 + ((y - CY) / RY) ** 2 <= 1


def outline(img: png.Image) -> png.Image:
    o = [r[:] for r in img]
    for y in range(H):
        for x in range(W):
            if img[y][x] == CLEAR and any(
                0 <= x + dx < W and 0 <= y + dy < H and img[y + dy][x + dx] != CLEAR
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
            ):
                o[y][x] = OUTL
    return o


def number(img: png.Image, left_facing: bool) -> None:
    """The hull number, between two ribs, always reading the right way round."""
    nx = W - 50 - 7 if left_facing else 50
    for d in "07":
        for gy, row in enumerate(DIGITS[d]):
            for gx, c in enumerate(row):
                if c == "X":
                    img[round(CY) - 6 + gy][nx + gx] = YEL
        nx += 4


def frame(n: int, left_facing: bool = False) -> png.Image:
    img = [[CLEAR] * W for _ in range(H)]

    def put(x: int, y: int, c: png.Pixel) -> None:
        if 0 <= x < W and 0 <= y < H:
            img[y][x] = c

    # Tail fins, cross-braced, with hazard stripes on their tips.
    for i in range(11):
        for x in range(12, 15 + i):
            for y, base in ((2 + i, HULL[2]), (29 - i, HULL[3])):
                c = base
                if x <= 13:
                    c = YEL if (x + y) % 4 < 2 else BLK
                elif (x - 12 - i) % 4 == 0 or x == 14 + i:
                    c = HULL[4]
                img[y][x] = c
    for i in range(0, 10, 3):
        put(14 + i, 8 + i // 2, METD)
        put(14 + i, 23 - i // 2, METD)
    # Hull: shading bands from the light above, with scattered darker pixels for texture.
    bands = (0.1, 0.24, 0.45, 0.65, 0.8, 0.92)
    for y in range(H):
        for x in range(W):
            if inhull(x, y):
                t = (y - (CY - RY)) / (2 * RY)
                b = next((i for i, edge in enumerate(bands) if t < edge), 6)
                if noise(x, y) < 0.1 and b < 6:
                    b += 1
                img[y][x] = HULL[b]
    # A highlight streak along the top.
    for x in range(CX - 20, CX + 22):
        y = round(CY - math.sqrt(max(0, 1 - ((x - CX) / RX) ** 2)) * RY * 0.78)
        if inhull(x, y) and noise(x, 3) < 0.85:
            img[y][x] = HULL[0] if x % 5 else MET
    # Lengthwise plating seams, following the curve.
    for f in (-0.55, -0.15, 0.3, 0.7):
        for x in range(W):
            if abs(x - CX) < RX:
                y = round(CY + f * RY * math.sqrt(1 - ((x - CX) / RX) ** 2))
                if inhull(x, y):
                    img[y][x] = SEAM
    # Reinforcement ribs wrapping from top to bottom, bowed to the hull's curve, riveted.
    for k in (-0.78, -0.5, -0.22, 0.06, 0.34, 0.62):
        for y in range(H):
            dy = (y - CY) / RY
            if abs(dy) >= 1:
                continue
            x = round(CX + k * RX * math.sqrt(1 - dy * dy))
            if not inhull(x, y):
                continue
            img[y][x] = RIBL if dy < -0.35 else RIB if dy < 0.45 else RIBD
            if inhull(x + 1, y):
                img[y][x + 1] = RIBD
            if y % 3 == 1:
                img[y][x] = RIVET
    # Nose cap: a riveted metal ring and the mooring cone.
    for y in range(H):
        for x in range(W):
            if inhull(x, y) and x > CX + RX - 6:
                img[y][x] = MET if y < CY - 3 else METD if y < CY + 5 else HULL[5]
                if x == round(CX + RX - 6) and y % 2 == 0:
                    img[y][x] = RIVET
    put(round(CX + RX) + 1, round(CY), METD)
    put(round(CX + RX) + 2, round(CY), MET)
    # Engine pods on the side.
    for ex in (30, 58):
        ey = round(CY) + 7
        for y in range(ey, ey + 4):
            for x in range(ex, ex + 8):
                img[y][x] = METD if y > ey else MET
        img[ey + 1][ex + 7] = OUTL
    # Gondola: struts, lit windows, a railing and an antenna.
    gx, gy, gw, gh = 36, 28, 22, 7
    for y in range(gy, gy + gh):
        for x in range(gx, gx + gw):
            img[y][x] = GONL if y == gy else (GOND if y == gy + gh - 1 else GON)
    for wx in range(gx + 3, gx + gw - 3, 4):
        img[gy + 2][wx] = WINH
        img[gy + 2][wx + 1] = WIN
        img[gy + 3][wx] = WIN
        img[gy + 3][wx + 1] = WIN
    for x in range(gx + 1, gx + gw - 1, 2):
        img[gy + gh - 2][x] = METD
    for y in range(gy + gh, gy + gh + 3):
        put(gx + gw - 4, y, METD)
    for sx in (gx + 2, gx + gw - 3):
        img[gy - 1][sx] = METD
    img = outline(img)

    # Propellers (tail and engines): upright in frame 0, flat in frame 1.
    def prop(x: int, y: int) -> None:
        for d in range(-3, 4):
            if n == 0:
                put(x, y + d, OUTL)
            else:
                put(x + d, y, OUTL)

    prop(9, round(CY))
    for ex in (30, 58):
        prop(ex - 2, round(CY) + 8)
    put(round(CX + RX) + 3, round(CY), WINH)  # nose light
    if left_facing:
        img = [list(reversed(row)) for row in img]
    number(img, left_facing)
    return img


def build(left_facing: bool = False) -> png.Image:
    """Two frames flying right, or mirrored to fly left (the number still reads 07)."""
    return png.strip([frame(0, left_facing), frame(1, left_facing)])
